import type { Ingredient, Price } from "./catalog/schema";
import type { Library } from "./types";

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
