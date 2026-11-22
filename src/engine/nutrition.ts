import type { Env } from "./env";
import type { WeekPlan } from "./types";
import { ALL_SLOTS, isRemoved, slotMap, weekendItems } from "./week";

/**
 * Nutrition de la vue imprimable (§8.6) : totaux par jour et moyennes, par adulte, midi et soir, du lundi au
 * dimanche : repas du batch (week-end compris s'il est préparé pendant la session) et recettes cuisinées sur place.
 */

export type Macros = [kcal: number, protein: number, carbs: number, fat: number];

export const NUTRITION_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function dayTotals(env: Env, w: WeekPlan): Record<number, Macros> {
  const map = slotMap(env, w);
  const fresh = new Map(weekendItems(env, w).map((x) => [x.k, x.r.m]));
  const tot: Record<number, Macros> = {};
  for (const d of NUTRITION_DAYS) tot[d] = [0, 0, 0, 0];
  for (const [d, meal] of ALL_SLOTS) {
    const k = `${d}-${meal}`;
    const s = map[k];
    const m = s && !isRemoved(w, d, meal) ? s.r.m : fresh.get(k);
    if (!m) continue;
    const day = tot[d]!;
    m.forEach((v, i) => (day[i] = (day[i] ?? 0) + v));
  }
  return tot;
}

/** Moyennes kcal et protéines par jour, sur les jours qui ont au moins un repas. */
export function dailyAverages(env: Env, w: WeekPlan): { kcal: number; protein: number } {
  const tot = dayTotals(env, w);
  const days = NUTRITION_DAYS.filter((d) => tot[d]![0] > 0);
  const nd = days.length || 1;
  return {
    kcal: Math.round(days.reduce((s, d) => s + tot[d]![0], 0) / nd),
    protein: Math.round(days.reduce((s, d) => s + tot[d]![1], 0) / nd),
  };
}
