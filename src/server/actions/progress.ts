"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { withAdmin } from "@/server/db";
import { type ActionResult } from "@/server/errors";
import { trackEvent } from "@/server/events";
import { cancelPause, finishSession, planPause } from "@/server/progress";
import { createProgressStore } from "@/server/progress-store";
import { loadProgressView } from "@/server/progress-view";
import { requireHousehold, withSession } from "@/server/session";

const uuid = z.uuid();
const monday = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type SessionDoneResult = {
  /** Réglage du compte : faux = rien à afficher. */
  visible: boolean;
  /** Série actuelle après cette session. */
  current: number;
};

const NOTHING: SessionDoneResult = { visible: false, current: 0 };

/**
 * Fin de session : `done_at`, recettes cuisinées, tampons, série (SPEC_PROGRES §3, §4). La semaine doit appartenir au
 * foyer actif, vérifié avec le client de l'utilisateur (RLS) avant toute écriture avec la clé de service.
 * Les tampons et le palier inscrits sont célébrés ensuite par la feuille globale (`CelebrationHost`).
 */
export async function finishSessionAction(weekId: string): Promise<SessionDoneResult> {
  if (!uuid.safeParse(weekId).success) return NOTHING;
  const { user, household } = await requireHousehold("/app/session");
  if (household.role === "viewer") return NOTHING;
  const data = await withSession((db) =>
    db
      .selectFrom("weeks")
      .select("id")
      .where("id", "=", weekId)
      .where("household_id", "=", household.id)
      .executeTakeFirst(),
  );
  if (!data) return NOTHING;
  await trackEvent("session_done", { userId: user.id, householdId: household.id, dedupeKey: weekId });
  await finishSession(createProgressStore(), { householdId: household.id, weekId });
  const view = await loadProgressView(household.id, user.id, { passport: false });
  return { visible: view.visible, current: view.streak.current };
}

const PAUSE_ERRORS = {
  past: fr.progress.errors.pausePast,
  too_far: fr.progress.errors.pauseTooFar,
  no_token: fr.progress.errors.pauseNoToken,
  closed: fr.progress.errors.pauseClosed,
  not_planned: fr.progress.errors.pauseNotPlanned,
} as const;

export async function planPauseAction(weekStart: string): Promise<ActionResult> {
  if (!monday.safeParse(weekStart).success) return { ok: false, error: fr.errors.generic };
  const { household } = await requireHousehold("/app/progress");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  const r = await planPause(createProgressStore(), { householdId: household.id, weekStart });
  revalidatePath("/app/progress");
  return r.ok ? { ok: true, data: undefined } : { ok: false, error: PAUSE_ERRORS[r.reason] };
}

export async function cancelPauseAction(weekStart: string): Promise<ActionResult> {
  if (!monday.safeParse(weekStart).success) return { ok: false, error: fr.errors.generic };
  const { household } = await requireHousehold("/app/progress");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  const r = await cancelPause(createProgressStore(), { householdId: household.id, weekStart });
  revalidatePath("/app/progress");
  return r.ok ? { ok: true, data: undefined } : { ok: false, error: PAUSE_ERRORS[r.reason] };
}

const seenSchema = z.array(z.string().regex(/^(streak|country|season):[a-z0-9-]{1,20}$/)).max(40);

/** Marque des tampons ou paliers comme vus (clés `country:jp`) : une seule célébration par tampon. */
export async function markAchievementsSeen(keys: string[]): Promise<void> {
  const parsed = seenSchema.safeParse(keys);
  if (!parsed.success || parsed.data.length === 0) return;
  const { household } = await requireHousehold("/app");
  const data = await withSession((db) =>
    db
      .selectFrom("achievements")
      .select(["kind", "key"])
      .where("household_id", "=", household.id)
      .where("seen_at", "is", null)
      .execute(),
  );
  const wanted = new Set(parsed.data);
  const rows = data.filter((a) => wanted.has(`${a.kind}:${a.key}`));
  if (rows.length === 0) return;
  await withAdmin(async (db) => {
    for (const a of rows) {
      await db
        .updateTable("achievements")
        .set({ seen_at: new Date().toISOString() })
        .where("household_id", "=", household.id)
        .where("kind", "=", a.kind)
        .where("key", "=", a.key)
        .where("seen_at", "is", null)
        .execute();
    }
  });
}

const viewSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("progress_viewed"), from: z.enum(["tile", "profile", "session"]) }),
  z.object({ name: z.literal("empty_stamp_tapped"), origin: z.string().regex(/^[a-z]{2}$/) }),
  z.object({ name: z.literal("progress_hidden") }),
  z.object({ name: z.literal("progress_shown") }),
]);

/** Événements d'interface du passeport (SPEC_PROGRES §7), un par compte et clic. */
export async function recordProgressEvent(input: unknown): Promise<void> {
  const parsed = viewSchema.safeParse(input);
  if (!parsed.success) return;
  const { user, household } = await requireHousehold("/app");
  const { name, ...props } = parsed.data;
  await trackEvent(name, { userId: user.id, householdId: household.id, props });
}
