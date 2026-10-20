import type { Ingredient } from "./catalog/schema";

/** Stock (§8.4) : pas des boutons − et + du garde-manger selon l'unité, ancienneté des plats congelés. */

export function pantryStep(ingredient: Pick<Ingredient, "u" | "half">, current: number): number {
  switch (ingredient.u) {
    case "g":
    case "ml":
      return current >= 1000 ? 250 : current >= 200 ? 100 : 50;
    case "pc":
      return ingredient.half ? 0.5 : 1;
    case "cs":
    case "cc":
      return 0.5;
    default:
      return 1;
  }
}

/** Un plat congelé depuis plus de 3 mois est signalé (§8.4). */
export function frozenTooLong(frozenAt: string, today: string): boolean {
  const limit = new Date(`${frozenAt}T12:00:00Z`);
  limit.setUTCMonth(limit.getUTCMonth() + 3);
  return new Date(`${today}T12:00:00Z`) > limit;
}

/** Semaines écoulées depuis la congélation. */
export const weeksSince = (frozenAt: string, today: string) =>
  Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${frozenAt}T12:00:00Z`)) / (7 * 86400000));
