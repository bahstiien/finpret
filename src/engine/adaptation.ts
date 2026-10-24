import { allocate } from "./allocation";
import { addsPastaClash, completeMains, monthOf } from "./compose";
import { allowed, type Env } from "./env";
import type { IssueDecision } from "./purchases";
import { listOccurrences, type Occurrence } from "./occurrences";
import type { PortionModel } from "./portions";
import { eligible } from "./season";
import { gMax } from "./slots";
import type { MenuSettings, WeekPlan } from "./types";

/**
 * Adaptation du menu aux courses réelles (lot L3) : propose, pour des manques sélectionnés, le remplacement
 * d'une préparation non commencée par une recette compatible du catalogue. Pur et déterministe : rien n'est
 * modifié, le résultat est un aperçu. Aucune contrainte alimentaire n'est relâchée : le catalogue de l'`env`
 * est déjà filtré par le régime, les allergies et les refus du foyer.
 */

export type SelectedIssue = { ingredient: string; decision: IssueDecision };

export type Replacement = { uid: string; recipeId: string };

export type Proposal = {
  replacements: Replacement[];
  /** Manques sélectionnés résolus et restants. */
  resolved: string[];
  remaining: string[];
  /** Achats supplémentaires que cette proposition ajoute (ingrédient, quantité). */
  extraPurchases: { ingredient: string; qty: number }[];
  /** Part des achats déjà faits que la proposition utilise, par ingrédient acheté. */
  reusedPurchases: { ingredient: string; qty: number }[];
  durationDelta: number;
  /** Objectifs souples relâchés : vide dans cette version (aucun n'est relâché). */
  relaxed: string[];
  /** Déficits après remplacement, tous ingrédients. */
  deficitsAfter: Record<string, number>;
  weekAfter: WeekPlan;
};

export type ProposeResult = {
  proposals: Proposal[];
  /** La recherche a été interrompue par le budget : l'absence de résultat ne prouve rien. */
  limited: boolean;
  evaluated: number;
  /** Préparations non verrouillées qui utilisent un manque sélectionné. */
  affected: string[];
  /** Préparations concernées mais verrouillées, avec leur raison d'exclusion. */
  excluded: { uid: string; reason: "locked" | "unsupported" }[];
};

export const MAX_EVALUATIONS = 200;
export const MAX_PROPOSALS = 3;

type Slotted = { kind: "main" | "soup" | "simple"; uid: string };

/** Remplace la recette d'une préparation (identité conservée). Renvoie null si la préparation n'existe pas. */
export function applyReplacement(week: WeekPlan, r: Replacement): WeekPlan | null {
  const w = structuredClone(week);
  const g = w.groups.find((x) => x.uid === r.uid);
  if (g) {
    g.id = r.recipeId;
    return w;
  }
  if (w.soup?.uid === r.uid) {
    w.soup.id = r.recipeId;
    return w;
  }
  const s = w.simples.find((x) => x.uid === r.uid);
  if (s) {
    s.id = r.recipeId;
    return w;
  }
  return null;
}

const activeMinutes = (r: { prepMin?: number; blocks?: { active: number }[] }) =>
  (r.prepMin ?? 0) + (r.blocks ?? []).reduce((s, b) => s + b.active, 0);

function recipeOf(env: Env, id: string) {
  return env.mainById.get(id) ?? env.soupById.get(id) ?? env.simpleById.get(id);
}

/** Recettes candidates pour une préparation, sous toutes les contraintes obligatoires. */
export function candidatesFor(
  env: Env,
  week: WeekPlan,
  slotted: Slotted,
  settings: MenuSettings | null,
): string[] {
  const month = monthOf(week.start);
  const minProtein = env.diet?.minProtein !== undefined;
  const usable = (r: { id: string; mu?: true }) => allowed(env, r) && !(minProtein && r.mu);
  if (slotted.kind === "soup") {
    const cur = week.soup!.id;
    return env.lib.soups
      .filter(
        (s) =>
          s.id !== cur &&
          eligible(env, s, month) &&
          usable(s) &&
          !addsPastaClash(env, week, { ...week, soup: { ...week.soup!, id: s.id } }),
      )
      .map((s) => s.id);
  }
  if (slotted.kind === "simple") {
    const idx = week.simples.findIndex((s) => s.uid === slotted.uid);
    const used = week.simples.map((s) => s.id);
    const wasComfort = !!env.simpleById.get(week.simples[idx]!.id)?.comfort;
    return env.lib.simples
      .filter(
        (s) =>
          !used.includes(s.id) &&
          eligible(env, s, month) &&
          usable(s) &&
          !!s.comfort === wasComfort &&
          !addsPastaClash(env, week, {
            ...week,
            simples: week.simples.map((x, j) => (j === idx ? { ...x, id: s.id } : x)),
          }),
      )
      .map((s) => s.id);
  }
  const idx = week.groups.findIndex((g) => g.uid === slotted.uid);
  const cur = week.groups.map((g) => g.id);
  const meals = week.groups[idx]!.meals;
  return env.lib.mains
    .filter((r) => {
      if (cur.includes(r.id) || !eligible(env, r, month) || !usable(r)) return false;
      if (!r.freeze && gMax(meals) > r.fridge) return false;
      const ids = cur.map((id, i) => (i === idx ? r.id : id));
      if (
        addsPastaClash(env, week, {
          ...week,
          groups: week.groups.map((g, i) => ({ meals: g.meals, id: ids[i]! })),
        })
      )
        return false;
      if (settings) {
        const list = ids.map((id) => env.mainById.get(id)!);
        if (!completeMains(list, { needCm: week.cm, pastaNeed: week.pastaNeed ?? null }, settings))
          return false;
      }
      return true;
    })
    .map((r) => r.id);
}

type Ctx = {
  env: Env;
  pm: PortionModel;
  cakeOn: boolean;
  locked: ReadonlySet<string>;
  stock: Readonly<Record<string, number | null | undefined>>;
  purchases: Readonly<Record<string, number>>;
  selected: readonly SelectedIssue[];
  baselineDeficits: Record<string, number>;
};

function evaluate(ctx: Ctx, base: WeekPlan, week: WeekPlan, replacements: Replacement[]): Proposal | null {
  const occs = listOccurrences(ctx.env, week, ctx.pm, ctx.cakeOn);
  const order = new Map(occs.map((o, i) => [o.uid, i]));
  const res = allocate({
    occurrences: occs.map((o) => ({ uid: o.uid, order: order.get(o.uid)!, needs: o.needs })),
    locked: ctx.locked,
    stock: ctx.stock,
    purchases: ctx.purchases,
  });
  const after: Record<string, number> = {};
  for (const [k, t] of Object.entries(res.byIngredient)) if (t.deficit > 0) after[k] = t.deficit;

  // « Ne plus acheter » : aucun complément de cet ingrédient n'est toléré, nulle part dans la proposition.
  for (const s of ctx.selected) if (s.decision === "no_more" && (after[s.ingredient] ?? 0) > 0) return null;

  const resolved = ctx.selected.filter((s) => (after[s.ingredient] ?? 0) === 0).map((s) => s.ingredient);
  if (resolved.length === 0) return null;
  const remaining = ctx.selected.filter((s) => (after[s.ingredient] ?? 0) > 0).map((s) => s.ingredient);

  const extraPurchases = Object.entries(after)
    .map(([ingredient, d]) => ({ ingredient, qty: d - (ctx.baselineDeficits[ingredient] ?? 0) }))
    .filter((e) => e.qty > 1e-9);
  const reusedPurchases = Object.entries(ctx.purchases)
    .map(([ingredient, bought]) => ({
      ingredient,
      qty: Math.min(bought, res.byIngredient[ingredient]?.purchase ?? 0),
    }))
    .filter((e) => e.qty > 0);

  const before = (id: string) =>
    activeMinutes((recipeOf(ctx.env, id) ?? {}) as { prepMin?: number; blocks?: { active: number }[] });
  const durationDelta = replacements.reduce((sum, r) => {
    const prev = originalRecipe(base, r.uid);
    return sum + before(r.recipeId) - (prev ? before(prev) : 0);
  }, 0);

  return {
    replacements,
    resolved,
    remaining,
    extraPurchases,
    reusedPurchases,
    durationDelta,
    relaxed: [],
    deficitsAfter: after,
    weekAfter: week,
  };
}

function originalRecipe(week: WeekPlan, uid: string): string | null {
  return (
    week.groups.find((g) => g.uid === uid)?.id ??
    (week.soup?.uid === uid ? week.soup.id : null) ??
    week.simples.find((s) => s.uid === uid)?.id ??
    null
  );
}

/**
 * Clé de classement déterministe (§12), la plus petite d'abord :
 * 1. manques sélectionnés non résolus sans achat supplémentaire (0 = tout résolu sans achat),
 * 2. nombre d'ingrédients supplémentaires, 3. préparations modifiées, 4. achats déjà faits réutilisés (plus = mieux,
 * comparés par couverture de chaque ingrédient, jamais en additionnant g, ml et pièces), 5. hausse de durée,
 * 6. préférences (recettes aimées), 7. identifiant stable.
 */
function rankKey(p: Proposal, ctx: Ctx): (number | string)[] {
  const unresolved = p.remaining.length;
  const reuseShare = p.reusedPurchases.reduce(
    (s, r) => s + r.qty / Math.max(ctx.purchases[r.ingredient] ?? 1, 1e-9),
    0,
  );
  const fav = p.replacements.filter((r) => ctx.env.ratings[r.recipeId] === 1).length;
  return [
    unresolved + (p.extraPurchases.length > 0 ? 1 : 0),
    p.extraPurchases.length,
    p.replacements.length,
    -Math.round(reuseShare * 1e6),
    p.durationDelta,
    -fav,
    p.replacements.map((r) => r.recipeId).join("+"),
  ];
}

const compareKeys = (a: (number | string)[], b: (number | string)[]) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]!) return -1;
    if (a[i]! > b[i]!) return 1;
  }
  return 0;
};

export function propose(input: {
  env: Env;
  week: WeekPlan;
  pm: PortionModel;
  cakeOn: boolean;
  locked: ReadonlySet<string>;
  selected: readonly SelectedIssue[];
  stock: Readonly<Record<string, number | null | undefined>>;
  purchases: Readonly<Record<string, number>>;
  settings?: MenuSettings | null;
  budget?: number;
}): ProposeResult {
  const budget = input.budget ?? MAX_EVALUATIONS;
  const occs = listOccurrences(input.env, input.week, input.pm, input.cakeOn);
  const base = allocate({
    occurrences: occs.map((o, i) => ({ uid: o.uid, order: i, needs: o.needs })),
    locked: input.locked,
    stock: input.stock,
    purchases: input.purchases,
  });
  const baselineDeficits: Record<string, number> = {};
  for (const [k, t] of Object.entries(base.byIngredient)) if (t.deficit > 0) baselineDeficits[k] = t.deficit;
  const ctx: Ctx = { ...input, baselineDeficits };

  const missing = new Set(
    input.selected.map((s) => s.ingredient).filter((k) => (baselineDeficits[k] ?? 0) > 0),
  );
  // Un manque sur une préparation figée est un écart, pas un déficit réallouable : elle reste listée comme exclue.
  const frozenGap = new Set(
    input.selected.map((s) => s.ingredient).filter((k) => (base.byIngredient[k]?.discrepancy ?? 0) > 0),
  );
  const uses = (o: Occurrence) =>
    Object.keys(o.needs).some((k) => missing.has(k) || (input.locked.has(o.uid) && frozenGap.has(k)));
  const excluded: ProposeResult["excluded"] = [];
  const affected: Slotted[] = [];
  for (const o of occs.filter(uses)) {
    if (input.locked.has(o.uid)) excluded.push({ uid: o.uid, reason: "locked" });
    else if (o.kind === "main" || o.kind === "soup" || o.kind === "simple")
      affected.push({ kind: o.kind, uid: o.uid });
    else excluded.push({ uid: o.uid, reason: "unsupported" });
  }

  let evaluated = 0;
  let limited = false;
  const found: Proposal[] = [];
  const singles: Proposal[] = [];

  outer: for (const slotted of affected) {
    for (const recipeId of candidatesFor(input.env, input.week, slotted, input.settings ?? null)) {
      if (evaluated >= budget) {
        limited = true;
        break outer;
      }
      evaluated++;
      const rep = { uid: slotted.uid, recipeId };
      const week = applyReplacement(input.week, rep);
      const p = week && evaluate(ctx, input.week, week, [rep]);
      if (p) {
        singles.push(p);
        found.push(p);
      }
    }
  }

  // Aucune solution seule ne résout tout : combinaisons de deux préparations, évaluées globalement
  // pour qu'elles ne puissent pas réclamer le même stock.
  if (!singles.some((p) => p.remaining.length === 0) && !limited && affected.length > 1) {
    const top = [...singles].sort((a, b) => compareKeys(rankKey(a, ctx), rankKey(b, ctx))).slice(0, 8);
    pairs: for (const a of top) {
      for (const slotted of affected) {
        if (slotted.uid === a.replacements[0]!.uid) continue;
        for (const recipeId of candidatesFor(input.env, a.weekAfter, slotted, input.settings ?? null)) {
          if (evaluated >= budget) {
            limited = true;
            break pairs;
          }
          evaluated++;
          const rep = { uid: slotted.uid, recipeId };
          const week = applyReplacement(a.weekAfter, rep);
          const p = week && evaluate(ctx, input.week, week, [...a.replacements, rep]);
          if (p && p.resolved.length > a.resolved.length) found.push(p);
        }
      }
    }
  }

  const seen = new Set<string>();
  const proposals = found
    .sort((a, b) => compareKeys(rankKey(a, ctx), rankKey(b, ctx)))
    .filter((p) => {
      const sig = p.replacements
        .map((r) => `${r.uid}:${r.recipeId}`)
        .sort()
        .join("|");
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    })
    .slice(0, MAX_PROPOSALS);
  return {
    proposals,
    limited,
    evaluated,
    affected: affected.map((a) => a.uid),
    excluded,
  };
}
