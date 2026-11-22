import { fmtQ, num, snapNum } from "./format";
import type { Library } from "./types";

/**
 * Détails d'une étape de session : ingrédients cités (avec ou sans placeholder) et quantités écrites en dur
 * dans le texte, remises à l'échelle du nombre de portions cuisinées.
 */

/** Minuscules, sans accents, œ → oe, apostrophes droites : pour comparer le texte et les noms d'ingrédients. */
export const normText = (s: string) =>
  s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[’`]/g, "'")
    .replace(/-/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Noms sous lesquels un ingrédient peut apparaître dans un texte de recette. */
function aliases(lib: Library, k: string): string[] {
  const g = lib.ingredients[k];
  if (!g) return [];
  const base = new Set<string>();
  if (/^[a-z]+$/.test(k)) base.add(k);
  base.add(normText(g.l));
  for (const n of g.n ?? []) base.add(normText(n));
  const out = new Set<string>();
  for (const a of base) {
    if (a.length < 3) continue;
    out.add(a);
    if (a.length >= 4) out.add(a.endsWith("s") ? a.slice(0, -1) : a + "s");
  }
  // Les unités (« gousse ») ne désignent pas l'ingrédient à elles seules.
  if (g.showN) for (const n of g.n ?? []) out.delete(normText(n));
  return [...out];
}

/**
 * Ingrédients de `keys` cités dans un texte de recette brut (avant `fill`) : par placeholder `{clé}` ou par leur
 * nom (« l'oignon », « les poivrons »). « Les légumes » renvoie aux légumes de la variante de saison.
 */
export function mentionedIngredients(
  lib: Library,
  text: string,
  keys: readonly string[],
  seasonKeys: readonly string[] = [],
): Set<string> {
  const found = new Set<string>();
  const allowed = new Set(keys);
  for (const m of text.match(/\{(\w+)\}/g) ?? []) {
    const k = m.slice(1, -1);
    if (allowed.has(k)) found.add(k);
  }
  let t = ` ${normText(text.replace(/\{\w+\}/g, " "))} `;
  const pairs = keys
    .filter((k) => !found.has(k))
    .flatMap((k) => aliases(lib, k).map((a) => [a, k] as const))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [a, k] of pairs) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRe(a)}(?![a-z0-9])`, "g");
    if (re.test(t)) {
      found.add(k);
      t = t.replace(re, " ");
    }
  }
  if (/(?<![a-z])legumes?(?![a-z])/.test(t)) for (const k of seasonKeys) if (allowed.has(k)) found.add(k);
  if (/(?<![a-z])viandes?(?![a-z])/.test(t))
    for (const k of keys) if (lib.ingredients[k]?.c === "viande") found.add(k);
  return found;
}

const UNIT_RE = /(\d+(?:[,.]\d+)?|½|¼)(\s?)(c\.\s?s\.|c\.\s?c\.|gousses?|kg|g|cl|ml|l)(?![\p{L}\d])/gu;

/** Nombre court au format français, ½ pour 0,5. */
function fmtNum(x: number): string {
  if (x === 0.5) return "½";
  return num(Math.round(x * 10) / 10);
}

/**
 * Remet à l'échelle les quantités écrites en dur (« 2 c.s. d'huile », « 100 ml d'eau », « 2 gousses ») : les
 * recettes sont écrites pour 4 portions, `sc` est le facteur de la session. Les durées, températures et
 * dimensions ne bougent pas.
 */
export function scaleText(text: string, sc: number): string {
  if (Math.abs(sc - 1) < 0.01) return text;
  return text.replace(UNIT_RE, (all, n: string, sp: string, unit: string) => {
    const v = n === "½" ? 0.5 : n === "¼" ? 0.25 : Number(n.replace(",", "."));
    if (!(v > 0)) return all;
    const q = v * sc;
    const u = unit.replace(/\s/g, "");
    if (u === "c.s." || u === "c.c.") return `${fmtNum(Math.max(0.5, Math.round(q * 2) / 2))}${sp}${unit}`;
    if (u.startsWith("gousse")) {
      const r = Math.max(1, Math.round(q));
      return `${r}${sp}${r > 1 ? "gousses" : "gousse"}`;
    }
    if (u === "g" || u === "ml") {
      const r =
        q < 20 ? Math.max(1, Math.round(q)) : q < 100 ? Math.round(q / 5) * 5 : Math.round(q / 10) * 10;
      return `${r}${sp}${unit}`;
    }
    return `${fmtNum(Math.round(q * 10) / 10)}${sp}${unit}`;
  });
}

/** Quantité d'un ingrédient pour un plat mis à l'échelle (mêmes arrondis que la liste de la session). */
export function scaledQty(lib: Library, k: string, base: number, sc: number): number {
  let q = snapNum(lib, k, base * sc);
  if (lib.ingredients[k]!.u === "boite") q = Math.max(1, Math.round(q));
  return q;
}

/** Libellé court : « 2 carottes », « Ail : 3 gousses », « Riz : 250 g ». */
export function ingredientChip(lib: Library, k: string, q: number): string {
  const g = lib.ingredients[k]!;
  const qty = fmtQ(lib, k, q);
  if (g.u === "pc" && !g.showN && g.n) return qty;
  return `${g.l} : ${qty}${g.u === "boite" ? (g.s ?? "") : ""}`;
}
