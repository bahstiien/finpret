import type { Env } from "./env";
import { isFav } from "./env";
import type { Resolved } from "./types";

/** Saisonnalité et variantes (§7.2) : port de vegKeys, pantryCovers, optOk, eligible, resolve, pantryScore, wshuffle. */

type Ing = Record<string, number>;
type Variant = { m: number[]; l: string; ing: Ing; prep: string[] };
type Seasonal = { months?: number[]; ing: Ing; sv?: Variant[] };

const inPantry = (env: Env, key: string) => env.pantry[key] !== undefined;

/** Légumes soumis à la saisonnalité dans une liste d'ingrédients. */
export function vegKeys(env: Env, ing: Ing): string[] {
  return Object.keys(ing).filter(
    (k) => env.lib.ingredients[k]?.c === "legumes" && !env.lib.notSeasonal.includes(k),
  );
}

/** Tous les légumes saisonniers de la recette sont au garde-manger. */
export function pantryCovers(env: Env, ing: Ing): boolean {
  const v = vegKeys(env, ing);
  return v.length > 0 && v.every((k) => inPantry(env, k));
}

const optOk = (env: Env, o: Variant, month: number) => o.m.includes(month) || pantryCovers(env, o.ing);

/** Recette proposable au mois donné. */
export function eligible(env: Env, r: Seasonal, month: number): boolean {
  return (
    (!r.months || r.months.includes(month) || pantryCovers(env, r.ing)) &&
    (!r.sv || r.sv.some((o) => optOk(env, o, month)))
  );
}

/** Fusionne la variante de saison retenue : celle du garde-manger, sinon celle du mois, sinon la première. */
export function resolve<R extends Seasonal & { prep?: string[]; blocks?: { a: string[] }[] }>(
  env: Env,
  r: R,
  month: number,
): Resolved<R> {
  if (!r.sv) return r;
  const o = r.sv.find((x) => pantryCovers(env, x.ing)) ?? r.sv.find((x) => x.m.includes(month)) ?? r.sv[0]!;
  const out: Resolved<R> = { ...r, ing: { ...r.ing, ...o.ing }, svl: o.l };
  if (r.prep) out.prep = [...r.prep, ...o.prep];
  else if (r.blocks)
    out.blocks = [{ ...r.blocks[0]!, a: [...o.prep, ...r.blocks[0]!.a] }, ...r.blocks.slice(1)];
  return out;
}

/** Poids du garde-manger : 1 par ingrédient de viande, de frais ou de légumes en stock, 0,3 sinon. */
export function pantryScore(env: Env, r: Seasonal | null | undefined): number {
  if (!r) return 0;
  const ing = r.sv ? { ...r.ing, ...(r.sv.find((o) => pantryCovers(env, o.ing))?.ing ?? {}) } : r.ing;
  return Object.keys(ing)
    .filter((k) => inPantry(env, k))
    .reduce((s, k) => s + (["viande", "frais", "legumes"].includes(env.lib.ingredients[k]!.c) ? 1 : 0.3), 0);
}

/** Tirage pondéré : priorité au garde-manger et aux favoris (+0,7), léger bonus pour les recettes importées. */
export function wshuffle<R extends Seasonal & { id: string }>(env: Env, arr: readonly R[]): R[] {
  return arr
    .map((r) => ({
      r,
      k: env.random() - 1.0 * pantryScore(env, r) - (isFav(env, r) ? 0.7 : 0) - (env.bonus[r.id] ?? 0),
    }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
}
