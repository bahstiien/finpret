import type { Main } from "./catalog/schema";
import {
  addsPastaClash,
  bankBoxes,
  completeMains,
  type ComposeState,
  monthOf,
  pastaClash,
  pickMains,
} from "./compose";
import { allowed, anyRecipe, bankRecipe, effectiveSettings, type Env } from "./env";
import { shuffle } from "./random";
import { eligible, wshuffle } from "./season";
import { assignGroups, gMax, sortMeals } from "./slots";
import type { BankEntry, Guests, Meal, MenuSettings, WeekPlan } from "./types";
import { isRemoved, WEEKEND_SLOTS } from "./week";

/**
 * Modifications d'une semaine (§8.1, §8.7) : port de swap (Changer), toggleMeal (Retirer / Remettre),
 * moveSlot, slotEntity, setEntitySlot, canGo, suggestWeekend. Chaque fonction renvoie une nouvelle semaine.
 */

const clone = (w: WeekPlan): WeekPlan => structuredClone(w);

export type SwapKind = "main" | "soup" | "simple" | "bank";
export type SwapResult =
  | { ok: true; week: WeekPlan; replaced: string; added: string[] }
  | { ok: false; reason: "no_bank_alternative" | "no_soup" | "no_simple" | "no_main" };

/** Repas de la réserve encore disponibles pour une recette, hors ceux déjà prévus cette semaine. */
export function bankAvailable(env: Env, w: WeekPlan, bank: readonly BankEntry[], id: string): number {
  const used = (w.bank ?? []).filter((s) => s.id === id && !isRemoved(w, s.day, s.meal)).length;
  return (bankBoxes(env, bank).find((e) => e.id === id)?.boxes ?? 0) - used;
}

/** « Changer » : remplace un plat sans créer de nouveau conflit de pâtes, en respectant les réglages. */
export function swap(
  env: Env,
  week: WeekPlan,
  rawSettings: MenuSettings,
  kind: SwapKind,
  idx: number,
  bank: readonly BankEntry[] = [],
): SwapResult {
  const settings = effectiveSettings(env, rawSettings);
  const w = clone(week);
  const month = monthOf(w.start);

  if (kind === "bank") {
    const cur = w.bank[idx]!.id;
    const ids = bankBoxes(env, bank).map((e) => e.id);
    const c = shuffle(
      ids.filter((id) => id !== cur && bankAvailable(env, w, bank, id) > 0),
      env.random,
    )[0];
    if (!c) return { ok: false, reason: "no_bank_alternative" };
    w.bank[idx]!.id = c;
    return { ok: true, week: w, replaced: cur, added: [c] };
  }

  const target = kind === "soup" ? w.soup!.id : kind === "simple" ? w.simples[idx]!.id : w.groups[idx]!.id;
  w.locked = (w.locked ?? []).filter((x) => x !== target);

  if (kind === "soup") {
    const c = shuffle(
      env.lib.soups.filter(
        (s) =>
          s.id !== w.soup!.id &&
          eligible(env, s, month) &&
          allowed(env, s) &&
          !addsPastaClash(env, w, { ...w, soup: { ...w.soup!, id: s.id } }),
      ),
      env.random,
    )[0];
    if (!c) return { ok: false, reason: "no_soup" };
    const old = w.soup!.id;
    w.soup!.id = c.id;
    return { ok: true, week: w, replaced: old, added: [c.id] };
  }

  if (kind === "simple") {
    const used = w.simples.map((s) => s.id);
    const wasComfort = !!env.simpleById.get(w.simples[idx]!.id)?.comfort;
    const c = shuffle(
      env.lib.simples.filter(
        (s) =>
          !used.includes(s.id) &&
          eligible(env, s, month) &&
          allowed(env, s) &&
          !!s.comfort === wasComfort &&
          !addsPastaClash(env, w, {
            ...w,
            simples: w.simples.map((x, j) => (j === idx ? { ...x, id: s.id } : x)),
          }),
      ),
      env.random,
    )[0];
    if (!c) return { ok: false, reason: "no_simple" };
    const old = w.simples[idx]!.id;
    w.simples[idx]!.id = c.id;
    return { ok: true, week: w, replaced: old, added: [c.id] };
  }

  const st: ComposeState = { needCm: w.cm, pastaNeed: w.pastaNeed ?? null };
  const groups = w.groups.map((g) => g.meals);
  const cur = w.groups.map((g) => g.id);
  const old = cur[idx]!;
  const byId = (id: string) => env.mainById.get(id)!;
  const cands = wshuffle(
    env,
    env.lib.mains.filter((r) => !cur.includes(r.id) && eligible(env, r, month) && allowed(env, r)),
  );
  const okAt = (ids: string[]) =>
    ids.every((id, i) => byId(id).freeze || gMax(groups[i]!) <= byId(id).fridge);
  const clashIds = (ids: string[] | null) =>
    !ids ||
    addsPastaClash(env, w, { ...w, groups: w.groups.map((g, i) => ({ meals: g.meals, id: ids[i]! })) });
  const complete = (ids: string[]) => completeMains(ids.map(byId) as Main[], st, settings);

  let ids: string[] | null = null;
  // 1. Remplacer sur place.
  for (const r of cands) {
    const t = cur.slice();
    t[idx] = r.id;
    if (complete(t) && okAt(t) && !clashIds(t)) {
      ids = t;
      break;
    }
  }
  // 2. Remplacer puis réattribuer les groupes (conservation).
  if (!ids) {
    for (const r of cands) {
      const t = cur.slice();
      t[idx] = r.id;
      if (complete(t)) {
        const a = assignGroups(t.map(byId), groups);
        if (a && !clashIds(a)) {
          ids = a;
          break;
        }
      }
    }
  }
  // 3. Remplacer deux plats à la fois.
  if (!ids) {
    outer: for (let j = 0; j < cur.length; j++) {
      if (j === idx) continue;
      for (const r1 of cands) {
        for (const r2 of cands) {
          if (r1 === r2) continue;
          const t = cur.slice();
          t[idx] = r1.id;
          t[j] = r2.id;
          if (complete(t)) {
            const a = assignGroups(t.map(byId), groups);
            if (a && !clashIds(a)) {
              ids = a;
              break outer;
            }
          }
        }
      }
    }
  }
  // 4. Recomposer tous les plats.
  for (let k = 0; k < 10 && !ids; k++) {
    const a = pickMains(env, st, settings, groups.length, groups, month, [old]);
    if (a && !clashIds(a)) ids = a;
  }
  if (!ids) return { ok: false, reason: "no_main" };
  const added = ids.filter((id) => !cur.includes(id));
  ids.forEach((id, i) => (w.groups[i]!.id = id));
  w.doubles = w.doubles.filter((i) => byId(w.groups[i]!.id).freeze);
  return { ok: true, week: w, replaced: old, added };
}

/** « Retirer » ou « Remettre » un repas : rien n'est cuisiné ni acheté pour ce créneau. */
export function toggleMeal(week: WeekPlan, day: number, meal: Meal): WeekPlan {
  const w = clone(week);
  const k = `${day}-${meal}`;
  w.removed = w.removed.includes(k) ? w.removed.filter((x) => x !== k) : [...w.removed, k];
  return w;
}

/** « Doubler » un plat congelable pour la réserve (ou annuler). */
export function toggleDouble(env: Env, week: WeekPlan, i: number): WeekPlan {
  const w = clone(week);
  if (!env.mainById.get(w.groups[i]!.id)?.freeze) return w;
  w.doubles = w.doubles.includes(i) ? w.doubles.filter((x) => x !== i) : [...w.doubles, i];
  w.banked = false;
  return w;
}

/** « Qui est à table ? » : convives d'un créneau (null pour revenir aux présents par défaut). */
export function setGuests(week: WeekPlan, day: number, meal: Meal, guests: Guests | null): WeekPlan {
  const w = clone(week);
  const k = `${day}-${meal}`;
  const next = { ...(w.guests ?? {}) };
  if (guests) next[k] = guests;
  else delete next[k];
  w.guests = next;
  return w;
}

type Entity =
  | { type: "main"; g: WeekPlan["groups"][number]; i: number; r: { s: string } }
  | { type: "soup"; i: number; r: { s: string } }
  | { type: "simple"; s: WeekPlan["simples"][number]; r: { s: string } }
  | { type: "bank"; b: WeekPlan["bank"][number]; r: { s: string } };

/** Ce qui occupe un créneau de la semaine. */
export function slotEntity(env: Env, w: WeekPlan, k: string): Entity | null {
  const [ds, m] = k.split("-") as [string, Meal];
  const d = Number(ds);
  for (const g of w.groups) {
    const i = g.meals.findIndex((x) => x.day === d && x.meal === m);
    if (i >= 0) return { type: "main", g, i, r: env.mainById.get(g.id)! };
  }
  if (w.soup && m === "dinner") {
    const i = w.soup.days.indexOf(d);
    if (i >= 0) return { type: "soup", i, r: env.soupById.get(w.soup.id)! };
  }
  for (const s of w.simples)
    if (m === "dinner" && s.day === d) return { type: "simple", s, r: env.simpleById.get(s.id)! };
  for (const b of w.bank ?? [])
    if (b.day === d && b.meal === m) return { type: "bank", b, r: bankRecipe(env, b.id)! };
  return null;
}

function setEntitySlot(w: WeekPlan, e: Entity | null, d: number, m: Meal) {
  if (!e) return;
  if (e.type === "main") e.g.meals[e.i] = { day: d, meal: m };
  else if (e.type === "soup") w.soup!.days[e.i] = d;
  else if (e.type === "simple") e.s.day = d;
  else {
    e.b.day = d;
    e.b.meal = m;
  }
}

/** Les soupes et les soirs simples restent le soir. */
export const canGo = (e: Entity | null, m: Meal) =>
  !e || !(e.type === "soup" || e.type === "simple") || m === "dinner";

export type MoveResult =
  | { ok: true; week: WeekPlan; warnings: { pasta: boolean; tooLate: string | null } }
  | { ok: false; reason: "weekend_boundary" | "dinner_only" | "pasta_clash" };

/**
 * « Déplacer » : échange deux créneaux de la même période (semaine ou week-end).
 * Écart assumé avec le prototype, qui avertissait seulement : un déplacement qui CRÉE un jour avec deux
 * repas de pâtes est refusé (§7.6) ; un conflit déjà présent ne bloque rien. Le dépassement de
 * conservation reste un avertissement (§8.7).
 */
export function moveSlot(env: Env, week: WeekPlan, a: string, b: string): MoveResult {
  const w = clone(week);
  const [da, ma] = a.split("-") as [string, Meal];
  const [db, mb] = b.split("-") as [string, Meal];
  const A = Number(da);
  const B = Number(db);
  if (A > 5 !== B > 5) return { ok: false, reason: "weekend_boundary" };
  if (A > 5) {
    const wk = { ...(w.weekend ?? {}) };
    const x = wk[a];
    const y = wk[b];
    if (y) wk[a] = y;
    else delete wk[a];
    if (x) wk[b] = x;
    else delete wk[b];
    w.weekend = wk;
    if (addsPastaClash(env, week, w)) return { ok: false, reason: "pasta_clash" };
    return { ok: true, week: w, warnings: { pasta: pastaClash(env, w), tooLate: null } };
  }
  const ea = slotEntity(env, w, a);
  const eb = slotEntity(env, w, b);
  if (!canGo(ea, mb) || !canGo(eb, ma)) return { ok: false, reason: "dinner_only" };
  const ra = isRemoved(w, A, ma);
  const rb = isRemoved(w, B, mb);
  setEntitySlot(w, ea, B, mb);
  setEntitySlot(w, eb, A, ma);
  w.groups.forEach((g) => g.meals.sort(sortMeals));
  if (w.soup) w.soup.days.sort((x, y) => x - y);
  w.removed = w.removed.filter((k) => k !== a && k !== b);
  if (ra && ea) w.removed.push(b);
  if (rb && eb) w.removed.push(a);
  if (addsPastaClash(env, week, w)) return { ok: false, reason: "pasta_clash" };
  const tooLate = w.groups
    .map((g) => env.mainById.get(g.id)!)
    .find((r, i) => !r.freeze && w.groups[i]!.meals.some((x) => x.day > r.fridge));
  return { ok: true, week: w, warnings: { pasta: pastaClash(env, w), tooLate: tooLate?.id ?? null } };
}

/** Créneaux proposés dans la feuille « Déplacer » : même période, et ceux qui ne créent pas de conflit. */
export function moveTargets(env: Env, week: WeekPlan, from: string) {
  const day = Number(from.split("-")[0]);
  const days = day > 5 ? [6, 7] : [1, 2, 3, 4, 5];
  return days.flatMap((d) =>
    (["lunch", "dinner"] as const).flatMap((m) => {
      const k = `${d}-${m}`;
      if (k === from) return [];
      const res = moveSlot(env, week, from, k);
      return [
        { key: k, ok: res.ok, reason: res.ok ? null : res.reason, warnings: res.ok ? res.warnings : null },
      ];
    }),
  );
}

/** Recette du week-end choisie à la main (ou retirée). */
export function setWeekend(env: Env, week: WeekPlan, k: string, id: string | null) {
  const w = clone(week);
  const wk = { ...(w.weekend ?? {}) };
  if (id) wk[k] = id;
  else delete wk[k];
  w.weekend = wk;
  return { week: w, pastaClash: !!id && pastaClash(env, w) };
}

/** « Suggérer des idées » pour les créneaux vides du week-end (cuisinés le jour même). */
export function suggestWeekend(env: Env, week: WeekPlan): { week: WeekPlan; added: number } {
  const w = clone(week);
  w.weekend = w.weekend ?? {};
  const month = monthOf(w.start);
  const ids = [...w.groups.map((g) => g.id), w.soup?.id, ...w.simples.map((s) => s.id)].filter(
    Boolean,
  ) as string[];
  const used = new Set([...ids, ...Object.values(w.weekend)]);
  const pool = <R extends { id: string; ing: Record<string, number>; months?: number[] }>(arr: R[]) =>
    wshuffle(
      env,
      arr.filter((r) => eligible(env, r, month) && allowed(env, r) && !used.has(r.id)),
    );
  let n = 0;
  for (const [d, m] of WEEKEND_SLOTS) {
    const k = `${d}-${m}`;
    if (w.weekend[k]) continue;
    const prefer =
      d === 6 && m === "dinner"
        ? pool(env.lib.simples.filter((r) => r.comfort))
        : m === "dinner"
          ? pool(env.lib.simples)
          : pool([...env.lib.mains, ...env.lib.simples] as (Main | (typeof env.lib.simples)[number])[]);
    const okP = (r: { id: string }) =>
      !anyRecipe(env, r.id)?.pasta || !addsPastaClash(env, w, { ...w, weekend: { ...w.weekend, [k]: r.id } });
    const r =
      prefer.find(okP) ??
      pool([...env.lib.simples, ...env.lib.mains] as (Main | (typeof env.lib.simples)[number])[]).find(okP);
    if (r) {
      w.weekend[k] = r.id;
      used.add(r.id);
      n++;
    }
  }
  return { week: w, added: n };
}
