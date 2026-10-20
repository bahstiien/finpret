import { batchCooks, hasBatch, simpleCooks, type PlannedCook } from "@/engine/cooks";
import { newAchievements, type CookRecord } from "@/engine/passport";
import {
  closeWeek,
  computeStreak,
  isInSessionWindow,
  PAUSES_PER_QUARTER,
  pausesUsedInQuarter,
  type StreakWeek,
} from "@/engine/streak";
import type { WeekPlan } from "@/engine/types";
import type { EventName } from "@/lib/events";
import { addDays, isoWeekday, mondayOf, todayIn } from "@/lib/dates";

/**
 * Série et passeport (SPEC_PROGRES §3, §4) : orchestration serveur au-dessus du moteur pur.
 * Tout passe par `ProgressStore` (implémenté avec la clé de service dans `progress-store.ts`) : la logique se teste
 * sans base. Le client ne calcule ni ne déclare rien (§2, principe 6).
 */

export type StoredStreakWeek = StreakWeek & { closedAt: string | null };
export type StoredWeek = { id: string; startDate: string; plan: WeekPlan };
export type NewAchievementRow = { kind: "streak" | "country" | "season"; key: string; seen: boolean };

export interface ProgressStore {
  timezone(householdId: string): Promise<string>;
  week(weekId: string): Promise<(StoredWeek & { householdId: string }) | null>;
  weeksBetween(householdId: string, from: string, to: string): Promise<StoredWeek[]>;
  /** Pose `done_at` s'il est vide ; renvoie la valeur finale (la première est conservée). */
  setDoneAt(weekId: string, at: Date): Promise<Date>;
  upsertCooks(householdId: string, weekId: string, cooks: PlannedCook[], backfilled: boolean): Promise<void>;
  cookRecords(householdId: string): Promise<CookRecord[]>;
  achievements(householdId: string): Promise<{ kind: string; key: string }[]>;
  insertAchievements(householdId: string, rows: NewAchievementRow[]): Promise<void>;
  streakWeeks(householdId: string): Promise<StoredStreakWeek[]>;
  /** `overwrite` : remplace une ligne existante (pause planifiée devenue `done`) ; sinon ne touche pas à l'existante. */
  putStreakWeek(householdId: string, row: StoredStreakWeek, options: { overwrite: boolean }): Promise<void>;
  removeStreakWeek(householdId: string, weekStart: string): Promise<void>;
  /** Foyers à traiter : une semaine fin prête dans l'historique, ou une semaine au plan depuis `sinceWeek`. */
  householdsToClose(sinceWeek: string): Promise<string[]>;
  track(
    name: EventName,
    householdId: string,
    props: Record<string, string | number | boolean | null>,
  ): Promise<void>;
}

const celebrated = (rows: { kind: string; key: string }[]) =>
  rows.filter((a) => a.kind === "streak").map((a) => Number(a.key));

/** Inscrit les tampons gagnés ; `seen` = déjà vus (rattrapage : rien n'est célébré). */
export async function grantAchievements(
  store: ProgressStore,
  householdId: string,
  options: { seen?: boolean } = {},
): Promise<{ kind: "country" | "season"; key: string }[]> {
  const [records, existing] = await Promise.all([
    store.cookRecords(householdId),
    store.achievements(householdId),
  ]);
  const fresh = newAchievements(records, new Set(existing.map((a) => `${a.kind}:${a.key}`)));
  if (fresh.length === 0) return [];
  await store.insertAchievements(
    householdId,
    fresh.map((a) => ({ ...a, seen: options.seen ?? false })),
  );
  if (!options.seen)
    for (const a of fresh) await store.track("stamp_earned", householdId, { kind: a.kind, key: a.key });
  return fresh;
}

export type FinishResult = {
  milestone: number | null;
  stamps: { kind: "country" | "season"; key: string }[];
};

/**
 * Fin de session (§3.1, §4.3) : pose `done_at` (première valeur conservée), inscrit les plats de batch et la soupe,
 * enregistre `done` si la session tombe dans la fenêtre, signale un éventuel palier et les nouveaux tampons.
 */
export async function finishSession(
  store: ProgressStore,
  input: { householdId: string; weekId: string; now?: Date },
): Promise<FinishResult> {
  const week = await store.week(input.weekId);
  if (!week || week.householdId !== input.householdId) return { milestone: null, stamps: [] };
  const tz = await store.timezone(input.householdId);
  const doneAt = await store.setDoneAt(week.id, input.now ?? new Date());
  const sessionDate = todayIn(tz, doneAt);

  await store.upsertCooks(input.householdId, week.id, batchCooks(week.plan, sessionDate), false);
  const stamps = await grantAchievements(store, input.householdId);

  let milestone: number | null = null;
  if (isInSessionWindow(doneAt, week.startDate, tz)) {
    const [history, ach] = await Promise.all([
      store.streakWeeks(input.householdId),
      store.achievements(input.householdId),
    ]);
    const existing = history.find((w) => w.weekStart === week.startDate);
    if (existing?.outcome !== "done") {
      await store.putStreakWeek(
        input.householdId,
        { weekStart: week.startDate, outcome: "done", closedAt: doneAt.toISOString() },
        { overwrite: true },
      );
      const state = computeStreak(
        history.filter((w) => w.weekStart !== week.startDate),
        { weekStart: week.startDate, sessionDone: true, hasBatch: true, plannedPause: false },
        celebrated(ach),
      );
      if (state.reachedMilestone) {
        milestone = state.reachedMilestone;
        await store.insertAchievements(input.householdId, [
          { kind: "streak", key: String(milestone), seen: false },
        ]);
        await store.track("streak_milestone", input.householdId, { milestone });
      }
    }
  }
  return { milestone, stamps };
}

/** Dernier lundi dont la fenêtre (mercredi 23:59 local) est close à la date locale `today`. */
export function lastClosableWeek(today: string): string {
  const monday = mondayOf(today);
  return isoWeekday(today) >= 4 ? monday : addDays(monday, -7);
}

export type CloseSummary = {
  households: number;
  closed: number;
  paused: number;
  missed: number;
  cooks: number;
};

/**
 * Clôture horaire (§3.4) pour un foyer : écrit le résultat de chaque semaine dont la fenêtre est close, puis inscrit les
 * soirs simples passés des dernières semaines. Idempotent : une ligne existante n'est jamais écrasée.
 * La série démarre à la première semaine fin prête : sans ligne `done`, rien n'est écrit.
 */
export async function closeHousehold(
  store: ProgressStore,
  householdId: string,
  now: Date,
): Promise<Omit<CloseSummary, "households">> {
  const out = { closed: 0, paused: 0, missed: 0, cooks: 0 };
  const tz = await store.timezone(householdId);
  const today = todayIn(tz, now);
  const limit = lastClosableWeek(today);
  const rows = await store.streakWeeks(householdId);
  const firstDone = rows
    .filter((r) => r.outcome === "done")
    .map((r) => r.weekStart)
    .sort()[0];

  if (firstDone) {
    const plans = new Map(
      (await store.weeksBetween(householdId, firstDone, limit)).map((w) => [w.startDate, w] as const),
    );
    const byStart = new Map(rows.map((r) => [r.weekStart, r]));
    for (let ws = firstDone; ws <= limit; ws = addDays(ws, 7)) {
      const row = byStart.get(ws);
      if (row && row.closedAt) continue;
      const history = [...byStart.values()].filter((r) => r.weekStart !== ws);
      const plan = plans.get(ws)?.plan;
      const result = closeWeek({
        sessionDoneInWindow: false, // une session terminée dans la fenêtre a déjà écrit `done` (finishSession)
        hasBatch: plan ? hasBatch(plan) : true,
        plannedPause: row?.outcome === "paused" && row.source === "planned",
        pausesUsedInQuarter: pausesUsedInQuarter(history, ws),
      });
      const closed: StoredStreakWeek = {
        weekStart: ws,
        outcome: result.outcome,
        ...(result.source ? { source: result.source } : {}),
        closedAt: now.toISOString(),
      };
      await store.putStreakWeek(householdId, closed, { overwrite: !!row });
      byStart.set(ws, closed);
      out.closed += 1;
      if (result.outcome === "paused") out.paused += 1;
      if (result.outcome === "missed") out.missed += 1;
      const state = computeStreak(
        [...byStart.values()].filter((r) => r.weekStart <= ws),
        { weekStart: addDays(ws, 7), sessionDone: false, hasBatch: false, plannedPause: false },
        [],
      );
      await store.track("streak_week_closed", householdId, {
        week_start: ws,
        outcome: result.outcome,
        source: result.source ?? null,
        current: state.current,
        best: state.best,
      });
    }
  }

  // Soirs simples : inscrits dès que leur jour est passé, sur les 3 dernières semaines (rattrape une panne).
  const from = addDays(mondayOf(today), -14);
  const recent = await store.weeksBetween(householdId, from, today);
  for (const w of recent) {
    const cooks = simpleCooks(w.plan, w.startDate, addDays(today, -1));
    if (cooks.length) {
      await store.upsertCooks(householdId, w.id, cooks, false);
      out.cooks += cooks.length;
    }
  }
  if (out.cooks) await grantAchievements(store, householdId);
  return out;
}

export async function closeDueWeeks(store: ProgressStore, now = new Date()): Promise<CloseSummary> {
  const households = await store.householdsToClose(addDays(mondayOf(todayIn("UTC", now)), -21));
  const total: CloseSummary = { households: households.length, closed: 0, paused: 0, missed: 0, cooks: 0 };
  for (const id of households) {
    const r = await closeHousehold(store, id, now);
    total.closed += r.closed;
    total.paused += r.paused;
    total.missed += r.missed;
    total.cooks += r.cooks;
  }
  return total;
}

export type PauseResult =
  { ok: true } | { ok: false; reason: "past" | "too_far" | "no_token" | "closed" | "not_planned" };

/** Pause planifiée : de la semaine suivante à 8 semaines plus tard, avec un jeton du trimestre de la semaine (§3.2). */
export async function planPause(
  store: ProgressStore,
  input: { householdId: string; weekStart: string; now?: Date },
): Promise<PauseResult> {
  const tz = await store.timezone(input.householdId);
  const today = todayIn(tz, input.now ?? new Date());
  const thisMonday = mondayOf(today);
  if (isoWeekday(input.weekStart) !== 1 || input.weekStart <= thisMonday)
    return { ok: false, reason: "past" };
  if (input.weekStart > addDays(thisMonday, 8 * 7)) return { ok: false, reason: "too_far" };
  const rows = await store.streakWeeks(input.householdId);
  if (rows.some((r) => r.weekStart === input.weekStart)) return { ok: true }; // déjà posée
  if (pausesUsedInQuarter(rows, input.weekStart) >= PAUSES_PER_QUARTER)
    return { ok: false, reason: "no_token" };
  await store.putStreakWeek(
    input.householdId,
    { weekStart: input.weekStart, outcome: "paused", source: "planned", closedAt: null },
    { overwrite: false },
  );
  await store.track("streak_pause_planned", input.householdId, { week_start: input.weekStart });
  return { ok: true };
}

/** Annule une pause planifiée encore non clôturée : le jeton revient. */
export async function cancelPause(
  store: ProgressStore,
  input: { householdId: string; weekStart: string },
): Promise<PauseResult> {
  const rows = await store.streakWeeks(input.householdId);
  const row = rows.find((r) => r.weekStart === input.weekStart);
  if (!row || row.source !== "planned") return { ok: false, reason: "not_planned" };
  if (row.closedAt) return { ok: false, reason: "closed" };
  await store.removeStreakWeek(input.householdId, input.weekStart);
  await store.track("streak_pause_cancelled", input.householdId, { week_start: input.weekStart });
  return { ok: true };
}
