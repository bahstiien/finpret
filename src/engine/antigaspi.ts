import type { Library, Pantry } from "./types";
import type { Totals } from "./quantities";

/** Anti-gaspi : urgence des ingrédients à date courte, ingrédients sauvés par une session, impact affiché dans Progrès. */

/** Date limite (« à utiliser avant le ») des ingrédients du garde-manger qui en ont une. */
export type UseBy = Record<string, string>;

/** Jours restants avant la date limite (négatif si elle est passée). */
export const daysLeft = (useBy: string, today: string) =>
  Math.round((Date.parse(`${useBy}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);

/** Date courte : à utiliser dans les 5 jours (ou déjà passée). */
export const URGENT_DAYS = 5;
export const isUrgent = (useBy: string | undefined, today: string) =>
  !!useBy && daysLeft(useBy, today) <= URGENT_DAYS;

/**
 * Bonus de tirage par ingrédient à date courte, ajouté à `pantryScore` :
 * +1,5 dans les 2 jours (ou date passée), +0,75 dans les 5 jours, rien au-delà.
 */
export function urgencyBonus(useBy: UseBy, today: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, d] of Object.entries(useBy)) {
    const left = daysLeft(d, today);
    if (left <= 2) out[k] = 1.5;
    else if (left <= URGENT_DAYS) out[k] = 0.75;
  }
  return out;
}

export type PantrySave = { k: string; qty: number | null; urgent: boolean };

/**
 * Ingrédients que la semaine prend dans le stock : la part du besoin couverte par le garde-manger
 * (tout le besoin si la quantité est « assez »). Les ingrédients `base` (sel, huile…) ne comptent pas.
 */
export function pantrySaves(
  lib: Library,
  pantry: Pantry,
  useBy: UseBy,
  t: Totals,
  today: string,
): PantrySave[] {
  const out: PantrySave[] = [];
  for (const [k, need] of Object.entries(t)) {
    if (!(k in pantry) || !need || lib.ingredients[k]?.c === "base") continue;
    const have = pantry[k];
    const qty = have === null || have === undefined ? null : Math.min(have, need);
    if (qty === 0) continue;
    out.push({ k, qty, urgent: isUrgent(useBy[k], today) });
  }
  return out.sort((a, b) => a.k.localeCompare(b.k));
}

export type Impact = {
  /** Ingrédients pris dans le stock plutôt qu'achetés. */
  count: number;
  /** Dont ingrédients à date courte. */
  urgent: number;
  /** Poids connu des ingrédients pesés (g et ml comptés à 1 g/ml), en grammes. */
  grams: number;
};

/** Somme des ingrédients sauvés. Les pièces et cuillères ne sont pas converties en poids. */
export function impactOf(lib: Library, saves: readonly { k: string; qty: number | null; urgent: boolean }[]): Impact {
  let grams = 0;
  for (const s of saves) {
    const u = lib.ingredients[s.k]?.u;
    if (s.qty !== null && (u === "g" || u === "ml")) grams += s.qty;
  }
  return { count: saves.length, urgent: saves.filter((s) => s.urgent).length, grams: Math.round(grams) };
}
