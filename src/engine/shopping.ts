import { AISLE_KEYWORDS } from "./aisle-keywords";
import type { Env } from "./env";
import { shopQ } from "./format";
import type { PortionModel } from "./portions";
import { needs, totals } from "./quantities";
import type { Pantry, WeekPlan } from "./types";

/** Liste de courses (§8.3) : articles du menu, placard à vérifier, classement et export (port du prototype). */

/** Rayon d'un article ajouté à la main (`guessCat` du prototype), « divers » s'il n'est pas reconnu. */
export function guessAisle(name: string): string {
  const n = ` ${name.toLowerCase()} `;
  for (const [aisle, keywords] of AISLE_KEYWORDS) if (keywords.some((k) => n.includes(k))) return aisle;
  return "divers";
}

/** Rayon où acheter un ingrédient du placard quand il manque (`BASE_RAYON` du prototype). */
export const baseAisle = (key: string) =>
  ({ oignon: "legumes", ail: "legumes", lait: "frais", beurre: "frais" })[key] ?? "epicerie";

export type MenuItem = { key: string; label: string; qty: string; aisle: string };

/**
 * Articles à acheter pour la semaine : besoin moins garde-manger, en contenants du commerce.
 * Les ingrédients du placard (`base`) n'y figurent que s'ils ont été cochés « à acheter ».
 */
export function shoppingList(
  env: Env,
  w: WeekPlan,
  pm: PortionModel,
  pantry: Pantry,
  cakeOn: boolean,
  baseToBuy: readonly string[],
): { items: MenuItem[]; baseUsed: MenuItem[]; covered: string[] } {
  const t = totals(env, w, pm, cakeOn);
  const { n, covered } = needs(pantry, t);
  const items: MenuItem[] = [];
  const baseUsed: MenuItem[] = [];
  for (const k of Object.keys(n)) {
    const g = env.lib.ingredients[k];
    if (!g) continue;
    const item = { key: k, label: g.l, qty: shopQ(env.lib, k, n[k]!), aisle: g.c };
    if (g.c === "base") {
      baseUsed.push(item);
      if (baseToBuy.includes(k)) items.push({ ...item, aisle: baseAisle(k) });
    } else items.push(item);
  }
  return { items, baseUsed, covered };
}

export type ExportLine = { aisle: string; text: string; checked: boolean };

/** Texte à envoyer dans Notes ou Messages : articles non cochés, dans l'ordre des rayons. */
export function shoppingText(
  title: string,
  lines: readonly ExportLine[],
  aisleOrder: readonly string[],
  checklist: boolean,
) {
  const rank = (a: string) => {
    const i = aisleOrder.indexOf(a);
    return i < 0 ? aisleOrder.length : i;
  };
  const rows = lines
    .filter((l) => !l.checked)
    .slice()
    .sort((a, b) => rank(a.aisle) - rank(b.aisle))
    .map((l) => (checklist ? `- [ ] ${l.text}` : l.text));
  return { text: [title, ...rows].join("\n"), count: rows.length };
}
