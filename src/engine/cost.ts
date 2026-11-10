import type { Ingredient, Price } from "./catalog/schema";
import type { Env } from "./env";
import { mealPd, type PortionModel } from "./portions";
import type { Library, Meal, WeekPlan } from "./types";

/** Coût des recettes à partir des prix de référence du catalogue (seed/prices.json). */

/** Base d'un prix selon l'unité de l'ingrédient : au kg pour les grammes, au litre pour les millilitres. */
export const pricePer = (unit: Ingredient["u"]): Price["per"] =>
  unit === "g" ? "kg" : unit === "ml" ? "l" : unit;

/** Prix par unité de recette (par g, par ml, par pièce…) d'un prix au kg, au litre ou à l'unité. */
export const unitPrice = (price: number, per: Price["per"]) =>
  per === "kg" || per === "l" ? price / 1000 : price;

export type PortionCost = {
  /** Euros par portion, ingrédients sans prix exclus. */
  eur: number;
  /** Ingrédients sans prix de référence (créés par le foyer, par exemple). */
  missing: string[];
};

/**
 * Coût d'une portion d'une recette dont `ing` donne les quantités pour 4 portions.
 * null si le catalogue n'a pas de prix, ou si aucun ingrédient de la recette n'en a.
 */
export function portionCost(lib: Library, ing: Record<string, number>): PortionCost | null {
  if (!lib.prices) return null;
  let total = 0;
  const missing: string[] = [];
  for (const [key, q] of Object.entries(ing)) {
    const price = lib.prices[key];
    if (price === undefined) missing.push(key);
    else total += q * price;
  }
  if (missing.length === Object.keys(ing).length) return null;
  return { eur: total / 4, missing };
}

/** Bonus maximal de tirage de la recette la moins chère (objectif économique) ; nul à partir du coût médian. */
export const ECONOMY_BONUS = 0.6;

/**
 * Bonus de tirage des recettes les moins chères par portion : de ECONOMY_BONUS pour la moins chère à 0 au coût
 * médian, rien au-delà ni pour les recettes sans prix. Un tirage plus probable, jamais un filtre.
 */
export function economyBonus(lib: Library, recipes: readonly { id: string; ing: Record<string, number> }[]) {
  const costs = recipes
    .map((r) => ({ id: r.id, eur: portionCost(lib, r.ing)?.eur }))
    .filter((x): x is { id: string; eur: number } => x.eur !== undefined)
    .sort((a, b) => a.eur - b.eur);
  const half = Math.floor(costs.length / 2);
  const bonus: Record<string, number> = {};
  for (let i = 0; i < half; i++) bonus[costs[i]!.id] = (ECONOMY_BONUS * (half - i)) / half;
  return bonus;
}

/**
 * Coût estimé d'une semaine : plats de batch, soupe et soirs simples, aux portions de chaque créneau.
 * Les repas du congélateur (déjà payés), le week-end et le goûter ne comptent pas ; un repas retiré non plus.
 */
export function weekCost(
  env: Pick<Env, "lib" | "mainById" | "soupById" | "simpleById">,
  w: Pick<WeekPlan, "groups" | "soup" | "simples" | "removed" | "guests">,
  pm: PortionModel,
): number {
  const removed = new Set(w.removed ?? []);
  const eur = (r: { ing: Record<string, number> } | undefined) =>
    r ? (portionCost(env.lib, r.ing)?.eur ?? 0) : 0;
  const portions = (meals: readonly { day: number; meal: Meal }[]) =>
    meals.reduce((s, m) => s + (removed.has(`${m.day}-${m.meal}`) ? 0 : mealPd(w, pm, m.day, m.meal)), 0);
  let total = 0;
  for (const g of w.groups) total += eur(env.mainById.get(g.id)) * portions(g.meals);
  if (w.soup)
    total += eur(env.soupById.get(w.soup.id)) * portions(w.soup.days.map((day) => ({ day, meal: "dinner" })));
  for (const x of w.simples)
    total += eur(env.simpleById.get(x.id)) * portions([{ day: x.day, meal: "dinner" }]);
  return total;
}
