import "server-only";
import {
  CHECKLIST_EVENT_NAMES,
  type ChecklistState,
  computeChecklist,
  type EventRow,
  newlyDone,
  type SavedSteps,
  TIP_KEYS,
  type TipKey,
  tipFor,
} from "@/engine/getting-started";
import type { SessionLevel } from "@/engine/types";
import { todayIn } from "@/lib/dates";
import { json, withAdmin } from "@/server/db";
import { householdCan } from "@/server/entitlements-load";
import { trackEvent } from "@/server/events";

/**
 * Seuls les foyers ayant fini l'onboarding à partir de cette date ont une checklist (SPEC_PRISE_EN_MAIN §8) :
 * la migration ne crée aucune ligne pour les foyers existants.
 */
export const GETTING_STARTED_SINCE = "2026-10-26T00:00:00Z";

export type ChecklistView = {
  state: ChecklistState;
  dismissed: boolean;
  /** Foyer et compte : le bouton « Inviter » n'est proposé qu'à l'administrateur. */
  isAdmin: boolean;
};

/**
 * Lit, recalcule et enregistre la checklist d'un foyer (la ligne est créée à la première arrivée sur Menu).
 * Les événements n'ont aucun accès client : tout passe par la clé de service. `null` : foyer sans checklist.
 */
export async function syncChecklist(
  householdId: string,
  opts: { now?: Date; isAdmin?: boolean } = {},
): Promise<ChecklistView | null> {
  const now = opts.now ?? new Date();
  const household = await withAdmin((db) =>
    db.selectFrom("households").select("onboarded_at").where("id", "=", householdId).executeTakeFirst(),
  );
  if (!household?.onboarded_at || Date.parse(household.onboarded_at) < Date.parse(GETTING_STARTED_SINCE)) return null;

  const loaded = await withAdmin(async (db) => {
    await db
      .insertInto("onboarding_progress")
      .values({
        household_id: householdId,
        steps: json({ discover_menu: { done_at: now.toISOString(), by: null, via: "event" } }),
      })
      .onConflict((oc) => oc.column("household_id").doNothing())
      .execute();
    const [row, events, members] = await Promise.all([
      db.selectFrom("onboarding_progress").selectAll().where("household_id", "=", householdId).executeTakeFirst(),
      db
        .selectFrom("events")
        .select(["name", "household_id", "user_id", "created_at"])
        .where("household_id", "=", householdId)
        .where("name", "in", [...CHECKLIST_EVENT_NAMES])
        .execute(),
      db
        .selectFrom("memberships")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("household_id", "=", householdId)
        .executeTakeFirstOrThrow(),
    ]);
    return { row, events, members: Number(members.n) };
  });
  const row = loaded.row;
  if (!row) return null;

  const rows: EventRow[] = loaded.events.map((e) => ({
    name: e.name,
    householdId: e.household_id,
    userId: e.user_id,
    at: e.created_at,
  }));
  const saved = row.steps as unknown as SavedSteps;
  const state = computeChecklist({
    now,
    householdId,
    createdAt: row.created_at,
    events: rows,
    accountCount: loaded.members || 1,
    saved,
    dismissedAt: row.dismissed_at,
    completedAt: row.completed_at,
  });

  const fresh = newlyDone(saved, state);
  const completedNow = state.completed && !row.completed_at;
  if (fresh.length || completedNow) {
    const steps = { ...saved };
    for (const key of fresh) {
      const s = state.steps[key];
      steps[key] = { done_at: s.doneAt ?? now.toISOString(), by: s.by, via: s.via ?? "event" };
    }
    await withAdmin((db) =>
      db
        .updateTable("onboarding_progress")
        .set({ steps: json(steps), ...(completedNow ? { completed_at: state.completedAt } : {}) })
        .where("household_id", "=", householdId)
        .execute(),
    );
    for (const key of fresh) {
      await trackEvent("onboarding_step_done", {
        householdId,
        dedupeKey: key,
        props: { step: key, via: state.steps[key].via ?? "event" },
      });
    }
    if (completedNow) await trackEvent("onboarding_completed", { householdId, dedupeKey: "completed" });
  }
  return { state, dismissed: !!row.dismissed_at, isAdmin: opts.isAdmin ?? false };
}

export type FirstSessionInfo = {
  /** Foyer avec checklist et aucune session terminée : la première session est encore à venir ou en cours. */
  active: boolean;
  started: boolean;
  /** Choix fait pour la première session (null = « débutant » par défaut). */
  override: SessionLevel | null;
  /**
   * Semaine de la première session terminée (plus ancien `session_done`) : elle garde le niveau de la première session,
   * sinon la fin de session changerait les étapes (et leur signature) au moment d'afficher l'écran de fin.
   */
  doneWeek: string | null;
};

/** La semaine `weekId` est-elle celle de la première session (à venir, en cours ou tout juste terminée) ? */
export const isFirstSessionFor = (info: FirstSessionInfo, weekId: string) =>
  info.active || (info.doneWeek !== null && info.doneWeek === weekId);

/** État de la première session du foyer (SPEC_PRISE_EN_MAIN §4.4) : lu avec la clé de service (événements sans accès client). */
export async function firstSessionInfo(householdId: string): Promise<FirstSessionInfo> {
  const { row, firstDone, started } = await withAdmin(async (db) => {
    const row = await db
      .selectFrom("onboarding_progress")
      .select("first_session_level")
      .where("household_id", "=", householdId)
      .executeTakeFirst();
    const firstDone = await db
      .selectFrom("events")
      .select("props")
      .where("household_id", "=", householdId)
      .where("name", "=", "session_done")
      .orderBy("created_at", "asc")
      .limit(1)
      .executeTakeFirst();
    const started = await db
      .selectFrom("events")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("household_id", "=", householdId)
      .where("name", "=", "session_started")
      .executeTakeFirstOrThrow();
    return { row, firstDone, started: Number(started.n) };
  });
  return {
    active: !!row && !firstDone,
    started: started > 0,
    override: row?.first_session_level ?? null,
    doneWeek: row && firstDone ? ((firstDone.props as { key?: string } | null)?.key ?? null) : null,
  };
}

/** Clés de `tips_seen` du compte. */
export async function tipsSeen(userId: string): Promise<string[]> {
  const row = await withAdmin((db) =>
    db.selectFrom("user_settings").select("tips_seen").where("user_id", "=", userId).executeTakeFirst(),
  );
  return row?.tips_seen ?? [];
}

/** Bulle à afficher sur un onglet pour ce compte, ou null (règles : `tipFor`). Le serveur décide, le client affiche. */
export async function tipForTab(
  tab: TipKey,
  ctx: { userId: string; householdId: string; timezone: string; otherTransient?: boolean },
): Promise<TipKey | null> {
  const today = todayIn(ctx.timezone);
  const [{ settings, shown }, canPantry] = await Promise.all([
    withAdmin(async (db) => {
      const [settings, shown] = await Promise.all([
        db.selectFrom("user_settings").select("tips_seen").where("user_id", "=", ctx.userId).executeTakeFirst(),
        db
          .selectFrom("events")
          .select(["created_at", "props"])
          .where("user_id", "=", ctx.userId)
          .where("name", "=", "tip_shown")
          .where("created_at", ">=", new Date(Date.now() - 48 * 3_600_000).toISOString())
          .execute(),
      ]);
      return { settings, shown };
    }),
    tab === "stock" ? householdCan(ctx.householdId, "pantry") : Promise.resolve(true),
  ]);
  // Les conseils de première session ne comptent pas dans la limite des 2 bulles par jour.
  const isTab = (props: unknown) => TIP_KEYS.includes((props as { key?: TipKey } | null)?.key as TipKey);
  const shownToday = shown.filter(
    (e) => isTab(e.props) && todayIn(ctx.timezone, new Date(e.created_at)) === today,
  ).length;
  return tipFor({
    tab,
    seen: settings?.tips_seen ?? [],
    shownToday,
    otherTransient: ctx.otherTransient ?? false,
    canPantry,
  });
}
