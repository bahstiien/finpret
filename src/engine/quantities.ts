import type { Env } from "./env";
import { packBest, snapNum } from "./format";
import { mealPd, type PortionModel } from "./portions";
import type { Pantry, WeekPlan } from "./types";
import { activeCake, activeMains, activeSimples, activeSoup, weekendItems } from "./week";

/** Totaux, besoins et restes (§7.4) : port de totals, needs, pantryAfterWeek. */

export type Totals = Record<string, number>;

/** Ingrédients d'une recette mis à l'échelle, arrondis aux contenants (une occurrence ou un total). */
export function scaleIngredients(env: Env, ing: Record<string, number>, sc: number): Totals {
  const out: Totals = {};
  for (const k in ing) {
    let q = snapNum(env.lib, k, ing[k]! * sc);
    if (env.lib.ingredients[k]?.u === "boite") q = Math.max(1, Math.round(q));
    out[k] = q;
  }
  return out;
}

/** Quantités totales de la semaine, arrondies aux contenants par recette. */
export function totals(env: Env, w: WeekPlan, pm: PortionModel, cakeOn: boolean): Totals {
  const t: Totals = {};
  const add = (ing: Record<string, number>, sc: number) => {
    const q = scaleIngredients(env, ing, sc);
    for (const k in q) t[k] = (t[k] ?? 0) + q[k]!;
  };
  for (const x of activeMains(env, w, pm)) if (x.P) add(x.r.ing, x.cookP / 4);
  const so = activeSoup(env, w, pm);
  if (so && so.P) add(so.r.ing, so.P / 4);
  for (const s of activeSimples(env, w)) if (s.on) add(s.r.ing, mealPd(w, pm, s.day, "dinner") / 4);
  const ck = activeCake(env, w, cakeOn);
  if (ck) add(ck.ing, 1);
  for (const x of weekendItems(env, w)) add(x.r.ing, mealPd(w, pm, x.d, x.m) / 4);
  return t;
}

/** Besoin d'achat : total moins stock ; une quantité nulle (« assez ») couvre le besoin. */
export function needs(pantry: Pantry, t: Totals): { n: Totals; covered: string[] } {
  const n: Totals = {};
  const covered: string[] = [];
  for (const k in t) {
    if (pantry[k] !== undefined) {
      const have = pantry[k];
      if (have === null || have >= t[k]!) {
        covered.push(k);
        continue;
      }
      n[k] = t[k]! - have;
    } else n[k] = t[k]!;
  }
  return { n, covered };
}

export type PantryChange = { k: string; before: number | null | undefined; after: number };

/**
 * Restes après la session : acheté + stock − utilisé, au-dessus d'un seuil (30 g, ou 10 % du plus
 * petit contenant). `after: 0` signifie que l'ingrédient est épuisé et sort du garde-manger.
 */
export function pantryAfterWeek(env: Env, pantry: Pantry, t: Totals): PantryChange[] {
  const out: PantryChange[] = [];
  for (const k in t) {
    const g = env.lib.ingredients[k];
    if (!g || g.c === "base") continue;
    const have = pantry[k];
    if (have === null) continue;
    const h = have === undefined ? 0 : have;
    const pack = env.lib.packs[k];
    let remain: number;
    if (pack && (g.u === "g" || g.u === "ml")) {
      const toBuy = Math.max(0, t[k]! - h);
      const b = toBuy > 0 ? (packBest(env.lib, k, toBuy) ?? { tot: toBuy }).tot : 0;
      remain = h + b - t[k]!;
    } else {
      if (have === undefined) continue;
      remain = Math.max(0, h - t[k]!);
    }
    remain =
      g.u === "g" || g.u === "ml"
        ? Math.round(remain / 10) * 10
        : g.half
          ? Math.round(remain * 2) / 2
          : Math.floor(remain);
    const minKeep = pack ? Math.max(30, pack.s[0]! * 0.1) : g.u === "g" || g.u === "ml" ? 30 : 1;
    if (remain >= minKeep) {
      if (remain !== have) out.push({ k, before: have, after: remain });
    } else if (have !== undefined) out.push({ k, before: have, after: 0 });
  }
  return out;
}

/** Garde-manger après application des restes. */
export function applyPantryChanges(pantry: Pantry, changes: readonly PantryChange[]): Pantry {
  const next = { ...pantry };
  for (const c of changes) {
    if (c.after > 0) next[c.k] = c.after;
    else delete next[c.k];
  }
  return next;
}
