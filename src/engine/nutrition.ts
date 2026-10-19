import type { Env } from "./env";
import type { WeekPlan } from "./types";
import { isRemoved, slotMap } from "./week";

/** Nutrition de la vue imprimable (§8.6) : totaux par jour et moyennes, par adulte, midi et soir (du lundi au vendredi). */

export type Macros = [kcal: number, protein: number, carbs: number, fat: number];

export function dayTotals(env: Env, w: WeekPlan): Record<number, Macros> {
  const map = slotMap(env, w);
  const tot: Record<number, Macros> = {};
  for (const d of [1, 2, 3, 4, 5]) {
    const day: Macros = [0, 0, 0, 0];
    for (const meal of ["lunch", "dinner"] as const) {
      const s = map[`${d}-${meal}`];
      if (!s || isRemoved(w, d, meal)) continue;
      s.r.m.forEach((v, i) => (day[i] = (day[i] ?? 0) + v));
    }
    tot[d] = day;
  }
  return tot;
}

/** Moyennes kcal et protéines par jour, sur les jours qui ont au moins un repas. */
export function dailyAverages(env: Env, w: WeekPlan): { kcal: number; protein: number } {
  const tot = dayTotals(env, w);
  const days = [1, 2, 3, 4, 5];
  const nd = days.filter((d) => tot[d]![0] > 0).length || 1;
  return {
    kcal: Math.round(days.reduce((s, d) => s + tot[d]![0], 0) / nd),
    protein: Math.round(days.reduce((s, d) => s + tot[d]![1], 0) / nd),
  };
}
