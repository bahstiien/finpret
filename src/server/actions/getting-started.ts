"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FIRST_SESSION_TIPS, TIP_KEYS, withSolo, type SavedSteps } from "@/engine/getting-started";
import { type Db, json, withAdmin } from "@/server/db";
import { trackEvent } from "@/server/events";
import { requireHousehold } from "@/server/session";

const tipKey = z.enum([...TIP_KEYS, ...FIRST_SESSION_TIPS]);
const level = z.enum(["beginner", "confident"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Les écritures passent par `withAdmin` : `onboarding_progress` et `tips_seen` n'ont aucun accès client en écriture. */
async function context() {
  return requireHousehold("/app");
}

const progress = (db: Db, householdId: string) =>
  db.updateTable("onboarding_progress").where("household_id", "=", householdId);

/** Ajoute une clé à `tips_seen` du compte, sans doublon. */
async function addSeen(userId: string, key: string) {
  await withAdmin(async (db) => {
    const row = await db.selectFrom("user_settings").select("tips_seen").where("user_id", "=", userId).executeTakeFirst();
    const seen = row?.tips_seen ?? [];
    if (!seen.includes(key)) {
      await db
        .updateTable("user_settings")
        .set({ tips_seen: [...seen, key] })
        .where("user_id", "=", userId)
        .execute();
    }
  });
}

/** « Masquer, je me débrouille » (ou « Fermer » après la réussite) : masque la carte pour tout le foyer. */
export async function dismissChecklistAction(): Promise<void> {
  const { user, household } = await context();
  await withAdmin((db) => progress(db, household.id).set({ dismissed_at: new Date().toISOString() }).execute());
  await trackEvent("onboarding_dismissed", { userId: user.id, householdId: household.id });
  revalidatePath("/app", "layout");
}

/** « Annuler » après le masquage, et « Relancer la checklist » depuis l'Aide. */
export async function restartChecklistAction(): Promise<void> {
  const { user, household } = await context();
  await withAdmin((db) => progress(db, household.id).set({ dismissed_at: null }).execute());
  await trackEvent("onboarding_restarted", { userId: user.id, householdId: household.id });
  revalidatePath("/app", "layout");
}

/** « Je cuisine seul·e » : valide l'étape facultative « Inviter » sans invitation. */
export async function chooseSoloAction(): Promise<void> {
  const { user, household } = await context();
  const done = await withAdmin(async (db) => {
    const row = await db
      .selectFrom("onboarding_progress")
      .select("steps")
      .where("household_id", "=", household.id)
      .executeTakeFirst();
    if (!row) return false;
    const saved = row.steps as unknown as SavedSteps;
    if (saved.invite) return false;
    await progress(db, household.id).set({ steps: json(withSolo(saved, user.id, new Date())) }).execute();
    return true;
  });
  if (!done) return;
  await trackEvent("onboarding_step_done", {
    userId: user.id,
    householdId: household.id,
    dedupeKey: "invite",
    props: { step: "invite", via: "solo" },
  });
  revalidatePath("/app", "layout");
}

/** Événement `tip_shown` : à l'affichage d'une bulle (compte pour la limite de 2 par jour). */
export async function tipShownAction(key: string): Promise<void> {
  const parsed = tipKey.safeParse(key);
  if (!parsed.success) return;
  const { user, household } = await context();
  await trackEvent("tip_shown", { userId: user.id, householdId: household.id, props: { key: parsed.data } });
}

/** « Compris », fermeture ou Échap : la clé est ajoutée à `tips_seen` du compte (pas du foyer). */
export async function tipDismissedAction(key: string): Promise<void> {
  const parsed = tipKey.safeParse(key);
  if (!parsed.success) return;
  const { user, household } = await context();
  await addSeen(user.id, parsed.data);
  await trackEvent("tip_dismissed", { userId: user.id, householdId: household.id, props: { key: parsed.data } });
}

/** Niveau choisi pour la première session (Sheet de préparation ou carte de démarrage) ; ne change pas le réglage du foyer. */
export async function setFirstSessionLevelAction(value: string): Promise<void> {
  const parsed = level.safeParse(value);
  if (!parsed.success) return;
  const { household } = await context();
  await withAdmin((db) => progress(db, household.id).set({ first_session_level: parsed.data }).execute());
  revalidatePath("/app", "layout");
}

/** Ouverture de la Sheet de préparation (événement d'indicateur). */
export async function prepSheetOpenedAction(): Promise<void> {
  const { user, household } = await context();
  await trackEvent("prep_sheet_opened", { userId: user.id, householdId: household.id });
}

/** « Plus tard » sur la Tile : masquée pour ce jour, de retour le jour de la session (clé datée par compte). */
export async function dismissPrepTileAction(date: string): Promise<void> {
  const parsed = isoDate.safeParse(date);
  if (!parsed.success) return;
  const { user } = await context();
  await addSeen(user.id, `prep_tile:${parsed.data}`);
}
