/** Série de semaines fin prêtes (SPEC_PROGRES §3). TypeScript pur : aucun import React ni accès à la base. */

export type WeekOutcome = "done" | "paused" | "neutral" | "missed";

export interface StreakWeek {
  weekStart: string; // ISO date du lundi
  outcome: WeekOutcome;
  source?: "auto" | "planned" | "admin";
}

export interface StreakState {
  current: number;
  best: number;
  currentWeek: "todo" | "done" | "paused" | "neutral";
  pausesLeftThisQuarter: number; // 0 à 2
  nextMilestone: number | null;
  reachedMilestone: number | null;
}

export const PAUSES_PER_QUARTER = 2;
export const MILESTONES = [4, 12, 26, 52] as const;

/** Paliers : 4, 12, 26, 52, puis tous les 52. */
export function isMilestone(n: number): boolean {
  return (MILESTONES as readonly number[]).includes(n) || (n > 52 && n % 52 === 0);
}

export function nextMilestoneAfter(n: number): number {
  for (const m of MILESTONES) if (m > n) return m;
  return (Math.floor(n / 52) + 1) * 52;
}

/** Identifiant de trimestre civil (année × 4 + index) d'une date ISO `YYYY-MM-DD`. */
export function quarterOf(isoDate: string): number {
  const [y = 0, m = 1] = isoDate.split("-").map(Number);
  return y * 4 + Math.floor((m - 1) / 3);
}

export function pausesUsedInQuarter(history: StreakWeek[], weekStart: string): number {
  const q = quarterOf(weekStart);
  return history.filter((w) => w.outcome === "paused" && quarterOf(w.weekStart) === q).length;
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const isoWeekday = (iso: string) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/**
 * Lundi de la semaine dont la fenêtre de session contient `today` : du lundi au mercredi, la semaine en cours ;
 * du jeudi au dimanche, la suivante (sa session a lieu le dimanche).
 */
export function activeWeekStart(today: string): string {
  const wd = isoWeekday(today);
  return wd <= 3 ? addDays(today, 1 - wd) : addDays(today, 8 - wd);
}

/** Date locale (`YYYY-MM-DD`) d'un instant dans un fuseau IANA. */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Fenêtre de session : du jeudi précédent 00:00 au mercredi 23:59 locaux (§3.1). */
export function isInSessionWindow(doneAt: Date, weekStart: string, timeZone: string): boolean {
  const day = localDate(doneAt, timeZone);
  return day >= addDays(weekStart, -4) && day <= addDays(weekStart, 2);
}

export function closeWeek(input: {
  sessionDoneInWindow: boolean;
  hasBatch: boolean;
  plannedPause: boolean;
  pausesUsedInQuarter: number;
}): { outcome: WeekOutcome; source?: "auto" | "planned" } {
  if (input.sessionDoneInWindow) return { outcome: "done" }; // jeton d'une pause planifiée rendu
  if (!input.hasBatch) return { outcome: "neutral" };
  if (input.plannedPause) return { outcome: "paused", source: "planned" };
  if (input.pausesUsedInQuarter < PAUSES_PER_QUARTER) return { outcome: "paused", source: "auto" };
  return { outcome: "missed" };
}

export function computeStreak(
  history: StreakWeek[],
  current: { weekStart: string; sessionDone: boolean; hasBatch: boolean; plannedPause: boolean },
  alreadyCelebrated: number[],
): StreakState {
  let run = 0;
  let best = 0;
  for (const w of [...history].sort((a, b) => a.weekStart.localeCompare(b.weekStart))) {
    if (w.outcome === "done") {
      run += 1;
      best = Math.max(best, run);
    } else if (w.outcome === "missed") {
      run = 0;
    }
  }

  let currentWeek: StreakState["currentWeek"];
  if (current.sessionDone) {
    currentWeek = "done";
    run += 1;
  } else if (!current.hasBatch) currentWeek = "neutral";
  else if (current.plannedPause) currentWeek = "paused";
  else currentWeek = "todo";
  best = Math.max(best, run);

  let used = pausesUsedInQuarter(history, current.weekStart);
  if (current.plannedPause && !current.sessionDone && current.hasBatch) used += 1;

  return {
    current: run,
    best,
    currentWeek,
    pausesLeftThisQuarter: Math.max(0, PAUSES_PER_QUARTER - used),
    nextMilestone: nextMilestoneAfter(run),
    reachedMilestone:
      current.sessionDone && isMilestone(run) && !alreadyCelebrated.includes(run) ? run : null,
  };
}
