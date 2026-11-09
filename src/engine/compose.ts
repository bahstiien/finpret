import type { Main } from "./catalog/schema";
import { portionCost, weekCost } from "./cost";
import { allowed, anyRecipe, bankRecipe, effectiveSettings, type Env, isWorld } from "./env";
import { isLiked } from "./feedback";
import type { PortionModel } from "./portions";
import { shuffle } from "./random";
import { eligible, wshuffle } from "./season";
import { assignGroups, buildSlots, gMax, type WeekSlots } from "./slots";
import type { BankEntry, MenuSettings, Slot, WeekPlan } from "./types";

/**
 * Composition de la semaine (§7.3) : port de fits, completeMains, pickMains, compose, fixPasta,
 * pastaCount, pastaClash, addsPastaClash, pickCake et de la génération avec repli (`generate`).
 * L'ordre des tirages aléatoires est celui du prototype : à graine égale, la même semaine.
 */

/** Contraintes de la tentative en cours (NEED_CM et PASTA_NEED du prototype). */
export type ComposeState = { needCm: number; pastaNeed: number | null };

const pastaNeedOf = (st: ComposeState, s: MenuSettings) => (st.pastaNeed === null ? s.pasta : st.pastaNeed);
/** Plafond de plats de pâtes dans la semaine (le minimum, lui, est un réglage). */
const pastaMax = (s: MenuSettings) => Math.max(3, s.pasta);

export const monthOf = (iso: string) => Number(iso.slice(5, 7));

export function fits(list: readonly Main[], st: ComposeState, s: MenuSettings): boolean {
  const c = { volaille: 0, boeuf: 0, veg: 0, poisson: 0, porc: 0 };
  let oven = 0;
  let pasta = 0;
  let cm = 0;
  const grp: Record<string, 1> = {};
  for (const r of list) {
    c[r.p]++;
    if (r.oven) oven++;
    if (r.pasta) pasta++;
    if (r.comfort) cm++;
    if (r.grp) {
      if (grp[r.grp]) return false;
      grp[r.grp] = 1;
    }
  }
  const caps = s.proteinCaps;
  return (
    cm <= st.needCm &&
    c.volaille <= caps.volaille &&
    c.boeuf <= caps.boeuf &&
    c.poisson <= caps.poisson &&
    c.porc <= caps.porc &&
    c.veg <= caps.veg &&
    oven <= s.ovenMax &&
    pasta <= pastaMax(s)
  );
}

export function completeMains(list: readonly Main[], st: ComposeState, s: MenuSettings): boolean {
  const n = list.length;
  return (
    fits(list, st, s) &&
    list.filter((r) => r.comfort).length === st.needCm &&
    (n < 4 || list.some((r) => r.p === "veg")) &&
    list.filter((r) => r.p === "veg").length >= Math.min(s.minVeg ?? 0, n) &&
    list.filter((r) => r.pasta).length >= Math.min(pastaNeedOf(st, s), n - 1)
  );
}

export function pickMains(
  env: Env,
  st: ComposeState,
  s: MenuSettings,
  n: number,
  groups: readonly Slot[][],
  month: number,
  exclude: readonly string[],
): string[] | null {
  const need = Math.min(pastaNeedOf(st, s), n - 1);
  for (let attempt = 0; attempt < 600; attempt++) {
    const pool = wshuffle(
      env,
      env.lib.mains.filter((r) => !exclude.includes(r.id) && eligible(env, r, month) && allowed(env, r)),
    );
    const chosen: Main[] = [];
    for (const r of pool) {
      if (r.comfort && chosen.filter((x) => x.comfort).length < st.needCm && fits([...chosen, r], st, s))
        chosen.push(r);
    }
    for (const r of pool) {
      if (
        r.pasta &&
        !chosen.includes(r) &&
        chosen.filter((x) => x.pasta).length < need &&
        fits([...chosen, r], st, s)
      ) {
        chosen.push(r);
      }
    }
    for (const r of pool) {
      if (chosen.length < n && !chosen.includes(r) && fits([...chosen, r], st, s)) chosen.push(r);
    }
    if (chosen.length === n && completeMains(chosen, st, s)) {
      const ids = assignGroups(chosen, groups);
      if (ids) return ids;
    }
  }
  return null;
}

export function pickCake(env: Env, month: number, avoid: readonly string[]): string {
  const ok = env.lib.cakes.filter((c) => (!c.months || c.months.includes(month)) && !avoid.includes(c.id));
  const pool = ok.length ? ok : env.lib.cakes.filter((c) => !c.months || c.months.includes(month));
  if (!pool.length) return "";
  return pool[Math.floor(env.random() * pool.length)]!.id;
}

/** Réserve regroupée par recette, la plus anciennement congelée d'abord (`bank` du prototype). */
export function bankBoxes(
  env: Env,
  bank: readonly BankEntry[],
): { id: string; boxes: number; added: string }[] {
  const byId = new Map<string, { id: string; boxes: number; added: string }>();
  for (const e of bank) {
    const cur = byId.get(e.recipeId);
    if (cur) {
      cur.boxes += e.portions;
      if (e.frozenAt < cur.added) cur.added = e.frozenAt;
    } else byId.set(e.recipeId, { id: e.recipeId, boxes: e.portions, added: e.frozenAt });
  }
  return [...byId.values()].filter((e) => e.boxes > 0 && bankRecipe(env, e.id));
}

export const bankTotal = (bank: readonly BankEntry[]) => bank.reduce((s, e) => s + (e.portions || 0), 0);

export function pickBank(env: Env, bank: readonly BankEntry[], n: number): string[] {
  const entries = bankBoxes(env, bank).sort((a, b) => (a.added < b.added ? -1 : a.added > b.added ? 1 : 0));
  const out: string[] = [];
  const used: Record<string, number> = {};
  while (out.length < n) {
    let added = false;
    for (const e of entries) {
      if (out.length >= n) break;
      if ((used[e.id] ?? 0) < e.boxes) {
        out.push(e.id);
        used[e.id] = (used[e.id] ?? 0) + 1;
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

/** Repas de pâtes par jour (soupes, soirs simples, réserve et week-end compris), hors repas retirés. */
export function pastaCount(
  env: Env,
  w: Pick<WeekPlan, "groups" | "soup" | "simples" | "bank" | "removed" | "weekend">,
) {
  const cnt: Record<number, number> = {};
  const add = (d: number) => (cnt[d] = (cnt[d] ?? 0) + 1);
  const rm = w.removed ?? [];
  for (const g of w.groups ?? []) {
    const r = env.mainById.get(g.id);
    if (r?.pasta) for (const m of g.meals) if (!rm.includes(`${m.day}-${m.meal}`)) add(m.day);
  }
  if (w.soup) {
    const r = env.soupById.get(w.soup.id);
    if (r?.pasta) for (const d of w.soup.days) if (!rm.includes(`${d}-dinner`)) add(d);
  }
  for (const x of w.simples ?? []) {
    const r = env.simpleById.get(x.id);
    if (r?.pasta && !rm.includes(`${x.day}-dinner`)) add(x.day);
  }
  for (const b of w.bank ?? []) {
    const r = bankRecipe(env, b.id);
    if (r?.pasta && !rm.includes(`${b.day}-${b.meal}`)) add(b.day);
  }
  if (w.weekend) {
    for (const k in w.weekend) {
      const r = anyRecipe(env, w.weekend[k]!);
      if (r?.pasta) add(Number(k.split("-")[0]));
    }
  }
  return cnt;
}

export const pastaClash = (env: Env, w: Parameters<typeof pastaCount>[1]) =>
  Object.values(pastaCount(env, w)).some((c) => c > 1);

/** Un changement n'est refusé que s'il CRÉE un jour avec deux repas de pâtes : un conflit déjà présent ne bloque rien. */
export function addsPastaClash(
  env: Env,
  before: Parameters<typeof pastaCount>[1],
  after: Parameters<typeof pastaCount>[1],
) {
  const a = pastaCount(env, before);
  const b = pastaCount(env, after);
  return Object.keys(b).some((d) => b[Number(d)]! > 1 && b[Number(d)]! > (a[Number(d)] ?? 0));
}

/** Permute les plats (dans la limite de leur conservation), puis les soirs simples, pour éviter deux repas de pâtes le même jour. */
export function fixPasta(env: Env, cand: WeekPlan): WeekPlan | null {
  if (!pastaClash(env, cand)) return cand;
  const meals = cand.groups.map((g) => g.meals);
  const objs = cand.groups.map((g) => env.mainById.get(g.id)!);
  for (let i = 0; i < 120; i++) {
    const perm = shuffle(objs, env.random);
    if (!perm.every((r, j) => r.freeze || gMax(meals[j]!) <= r.fridge)) continue;
    const c2 = { ...cand, groups: meals.map((m, j) => ({ meals: m, id: perm[j]!.id })) };
    if (!pastaClash(env, c2)) return c2;
  }
  if (cand.simples && cand.simples.length > 1) {
    for (let i = 0; i < 40; i++) {
      const days = shuffle(
        cand.simples.map((x) => x.day),
        env.random,
      );
      const c3 = { ...cand, simples: cand.simples.map((x, j) => ({ ...x, day: days[j]! })) };
      if (!pastaClash(env, c3)) return c3;
    }
  }
  return null;
}

/** Nombre de plats réconfort visé ; « 1 toutes les 2 semaines » dépend de la semaine précédente. */
export function comfortTarget(s: MenuSettings, previous: WeekPlan | null): number {
  if (s.comfort === 0.5)
    return previous && previous.groups && (previous.cm ?? 0) + (previous.cs ?? 0) > 0 ? 0 : 1;
  return Math.round(s.comfort);
}

export type ComposeInput = {
  env: Env;
  settings: MenuSettings;
  start: string;
  previous: WeekPlan | null;
  bank: readonly BankEntry[];
  /** Portions par créneau : nécessaires pour estimer le coût de la semaine (budget). */
  portions?: PortionModel;
};

/**
 * Une recette dont la portion coûte plus de PRICEY fois la cible du budget par portion passe après toutes
 * les autres au tirage (sans être exclue : les règles de composition peuvent encore l'exiger).
 */
export const PRICEY = 1.6;

/** Budget actif : réglé, avec les portions du foyer et les prix du catalogue pour l'estimer. */
export function budgetOf(input: ComposeInput): { max: number; portions: PortionModel } | null {
  const max = input.settings.budget ?? 0;
  return max > 0 && input.portions && input.env.lib.prices ? { max, portions: input.portions } : null;
}

/** Semaine la moins chère rejetée pour dépassement du budget, gardée en repli. */
export type OverBudget = { week: WeekPlan | null; cost: number };

/** Une tentative de composition (`compose` du prototype). */
export function compose(
  input: ComposeInput,
  exclude: readonly string[],
  target?: number,
  world?: number,
  over?: OverBudget,
): WeekPlan | null {
  const { env, start, previous, bank } = input;
  const s = effectiveSettings(env, input.settings);
  let T = target ?? comfortTarget(s, previous);
  let W = world ?? s.world;
  const month = monthOf(start);
  const skip = s.skip.slice();
  let bankIds = pickBank(env, bank, Math.min(s.bankUse, bankTotal(bank)));
  const { groups, soupDays, simpleDays, bankSlots }: WeekSlots = buildSlots(s.light, bankIds.length, skip);
  bankIds = bankIds.slice(0, bankSlots.length);
  T = Math.min(T, groups.length + simpleDays.length);
  W = Math.min(W, groups.length + (soupDays.length ? 1 : 0) + simpleDays.length);

  // Budget : les recettes nettement trop chères pour la cible par portion de la semaine passent en dernier
  // au tirage (bonus -1 : le tirage aléatoire vaut moins de 1), le temps de cette composition.
  const budget = budgetOf(input);
  const pricey = new Set<string>();
  if (budget) {
    const base = (day: number) => budget.portions.base(day, "dinner");
    const planned =
      groups.reduce((n, g) => n + g.reduce((m, x) => m + budget.portions.base(x.day, x.meal), 0), 0) +
      soupDays.reduce((n, d) => n + base(d), 0) +
      simpleDays.reduce((n, d) => n + base(d), 0);
    const cap = planned > 0 ? (budget.max / planned) * PRICEY : Infinity;
    for (const r of [...env.lib.mains, ...env.lib.soups, ...env.lib.simples]) {
      if ((portionCost(env.lib, r.ing)?.eur ?? 0) > cap) pricey.add(r.id);
    }
  }
  const bonus = env.bonus;
  if (pricey.size) {
    env.bonus = { ...bonus };
    for (const id of pricey) env.bonus[id] = (env.bonus[id] ?? 0) - 1;
  }
  const st: ComposeState = { needCm: 0, pastaNeed: null };
  const soupsOk = (strict: boolean) =>
    env.lib.soups.filter(
      (x) => eligible(env, x, month) && allowed(env, x) && (!strict || !exclude.includes(x.id)),
    );
  const simplesOk = (comfort: boolean, strict: boolean) =>
    env.lib.simples.filter(
      (x) =>
        eligible(env, x, month) &&
        allowed(env, x) &&
        !!x.comfort === comfort &&
        (!strict || !exclude.includes(x.id)),
    );

  for (let relax = 0; relax <= s.pasta; relax++) {
    st.pastaNeed = Math.max(0, s.pasta - relax);
    for (let attempt = 0; attempt < (relax ? 40 : 60); attempt++) {
      const S = simpleDays.length;
      const kS = S ? Math.floor(env.random() * (Math.min(T, S) + 1)) : 0;
      st.needCm = T - kS;
      if (st.needCm > groups.length) continue;
      const ids = pickMains(env, st, s, groups.length, groups, month, [...exclude, ...bankIds]);
      if (!ids) continue;
      const soups = wshuffle(env, soupsOk(true));
      const soup = soupDays.length ? (soups[0] ?? shuffle(soupsOk(false), env.random)[0] ?? null) : null;
      if (soupDays.length && !soup) continue;
      const sp = (c: boolean) =>
        wshuffle(env, simplesOk(c, true))
          .concat(shuffle(simplesOk(c, false), env.random))
          .filter((v, i, a) => a.indexOf(v) === i);
      const simples = shuffle([...sp(true).slice(0, kS), ...sp(false).slice(0, S - kS)], env.random);
      if (simples.length < S) continue;
      const mains = ids.map((id) => env.mainById.get(id)!);
      if ([...mains, soup, ...simples].filter(isWorld).length < W) continue;
      const cand: WeekPlan = {
        start,
        groups: groups.map((meals, i) => ({ meals, id: ids[i]! })),
        soup: soup ? { days: soupDays, id: soup.id } : null,
        simples: simpleDays.map((d, i) => ({ day: d, id: simples[i]!.id })),
        bank: bankSlots.map((sl, i) => ({ ...sl, id: bankIds[i]! })),
        doubles: [],
        banked: false,
        removed: [],
        skip,
        cake: pickCake(env, month, previous?.cake ? [previous.cake] : []),
        cm: st.needCm,
        cs: kS,
        pastaNeed: 0,
      };
      const fixed = fixPasta(env, cand);
      if (!fixed) continue;
      const week = { ...fixed, pastaNeed: st.pastaNeed };
      if (budget) {
        const cost = weekCost(env, week, budget.portions);
        if (cost > budget.max) {
          if (over && cost < over.cost) Object.assign(over, { week, cost });
          continue;
        }
      }
      env.bonus = bonus;
      return week;
    }
  }
  env.bonus = bonus;
  return null;
}

/** Identifiants des recettes d'une semaine (plats, soupe, soirs simples) : base de l'anti-répétition. */
export const weekRecipeIds = (w: WeekPlan) =>
  [...w.groups.map((g) => g.id), w.soup?.id ?? null, ...w.simples.map((x) => x.id)].filter(
    (x): x is string => !!x,
  );

export type GenerateResult =
  | {
      ok: true;
      week: WeekPlan;
      dislikesIgnored: boolean;
      relaxed: "none" | "history" | "world" | "dislikes";
      /** Coût estimé de la semaine (portions et prix connus), sinon null. */
      cost: number | null;
      /** Aucune semaine ne tenait dans le budget : la moins chère trouvée est proposée. */
      overBudget: boolean;
    }
  | { ok: false; reason: "impossible" };

/**
 * Génère une semaine avec repli (§7.3, points 5 et 6) : anti-répétition complète, puis semaine
 * précédente seule, puis aucune, puis sans l'objectif des recettes du monde, puis en ignorant les refus.
 * Avec un budget, toute semaine trop chère est écartée ; si aucune ne tient après l'objectif du monde,
 * la moins chère trouvée est proposée (hors budget) plutôt que d'ignorer les refus.
 * @param history identifiants des semaines précédentes, la plus récente d'abord
 */
export function generateWeek(
  input: ComposeInput & { history: readonly (readonly string[])[] },
): GenerateResult {
  const { env, settings: s, previous, history } = input;
  const current = history[0] ?? [];
  // Un plat aimé (à refaire, aimé des enfants) peut revenir plus tôt, mais jamais deux semaines de suite :
  // les deux semaines les plus récentes le bloquent, la fenêtre complète ne bloque que les autres.
  const recent = [
    ...new Set([
      ...current,
      ...history
        .slice(1, Math.max(1, s.noRepeatWeeks))
        .flatMap((ids, i) => (i === 0 ? ids : ids.filter((id) => !isLiked(env, id)))),
    ]),
  ];
  const T = comfortTarget(s, previous);
  const W = s.world;
  const over: OverBudget = { week: null, cost: Infinity };
  let relaxed: "none" | "history" | "world" | "dislikes" = "none";
  let w = compose(input, recent, T, W, over);
  if (!w) {
    relaxed = "history";
    w = compose(input, current, T, W, over) ?? compose(input, [], T, W, over);
  }
  if (!w) {
    relaxed = "world";
    w = compose(input, [], T, 0, over);
  }
  let overBudget = false;
  if (!w && over.week) {
    w = over.week;
    overBudget = true;
  }
  let dislikesIgnored = false;
  if (!w) {
    relaxed = "dislikes";
    env.ignoreDislike = true;
    w = compose(input, [], T, 0, over) ?? over.week;
    env.ignoreDislike = false;
    dislikesIgnored = !!w;
    overBudget = !!w && w === over.week;
  }
  if (!w) return { ok: false, reason: "impossible" };
  const cost = input.portions && env.lib.prices ? weekCost(env, w, input.portions) : null;
  return { ok: true, week: w, dislikesIgnored, relaxed, cost, overBudget };
}
