import type { PortionModel } from "./portions";
import type { SessionStep } from "./session";
import type { Guests, Meal } from "./types";

/**
 * Semaine figée au lancement de la session (« Commencer ma session ») : le menu, les portions et les étapes
 * ne bougent plus jusqu'à la fin de la semaine, même si le foyer, le garde-manger ou les réglages changent.
 */
export type FrozenWeek = {
  /** Date du lancement (ISO). */
  at: string;
  portions: PortionSnapshot;
  steps: SessionStep[];
  /** Durée totale de la session (minutes). */
  total: number;
};

/** Modèle de portions mis à plat (7 jours × 2 repas) pour être enregistré tel quel. */
export type PortionSnapshot = {
  counts: Record<string, Guests>;
  base: Record<string, number>;
  childFactor: number;
};

const MEALS: Meal[] = ["lunch", "dinner"];

export function snapshotPortions(pm: PortionModel): PortionSnapshot {
  const counts: Record<string, Guests> = {};
  const base: Record<string, number> = {};
  for (let d = 1; d <= 7; d++) {
    for (const m of MEALS) {
      counts[`${d}-${m}`] = pm.counts(d, m);
      base[`${d}-${m}`] = pm.base(d, m);
    }
  }
  return { counts, base, childFactor: pm.childFactor };
}

export function portionsFromSnapshot(s: PortionSnapshot): PortionModel {
  return {
    counts: (d, m) => s.counts[`${d}-${m}`] ?? { a: 0, c: 0 },
    base: (d, m) => s.base[`${d}-${m}`] ?? 0,
    childFactor: s.childFactor,
  };
}
