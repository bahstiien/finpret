import type { Cake, Main, Simple, Soup } from "./catalog/schema";
import { anyRecipe, bankRecipe, type Env } from "./env";
import { monthOf } from "./compose";
import { mealPd, type PortionModel } from "./portions";
import { resolve } from "./season";
import type { Meal, Resolved, Slot, WeekPlan } from "./types";

/** Lecture d'une semaine : repas actifs, portions, dates (port de slotMap, activeMains, activeSoup, activeSimples, weekendItems). */

export const isRemoved = (w: Pick<WeekPlan, "removed">, day: number, meal: Meal) =>
  w.removed.includes(`${day}-${meal}`);

const DAY_MS = 86400000;
/** Date du jour `i` de la semaine (1 = lundi, 0 = dimanche de la session). */
export const dayDate = (w: Pick<WeekPlan, "start">, i: number) =>
  new Date(Date.parse(`${w.start}T12:00:00Z`) + (i - 1) * DAY_MS);
export const dayIso = (w: Pick<WeekPlan, "start">, i: number) => dayDate(w, i).toISOString().slice(0, 10);
const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
/** « lundi » ; le jour 0 est le dimanche de la session. */
export const dayShort = (w: Pick<WeekPlan, "start">, i: number) =>
  i < 1 ? "dimanche" : weekday.format(dayDate(w, i));
export const mealLabel = (w: Pick<WeekPlan, "start">, m: Slot) =>
  `${dayShort(w, m.day)} ${m.meal === "lunch" ? "midi" : "soir"}`;

export type SlotEntry =
  | { kind: "main"; i: number; r: Resolved<Main> }
  | { kind: "soup"; r: Resolved<Soup> }
  | { kind: "simple"; i: number; r: Simple }
  | { kind: "bank"; i: number; r: Resolved<Main | Soup> };

/** Recette de chaque créneau du lundi au vendredi. */
export function slotMap(env: Env, w: WeekPlan): Record<string, SlotEntry> {
  const m = monthOf(w.start);
  const map: Record<string, SlotEntry> = {};
  w.groups.forEach((g, i) =>
    g.meals.forEach(
      (x) => (map[`${x.day}-${x.meal}`] = { kind: "main", i, r: resolve(env, env.mainById.get(g.id)!, m) }),
    ),
  );
  if (w.soup) {
    const r = resolve(env, env.soupById.get(w.soup.id)!, m);
    w.soup.days.forEach((d) => (map[`${d}-dinner`] = { kind: "soup", r }));
  }
  w.simples.forEach((s, i) => (map[`${s.day}-dinner`] = { kind: "simple", i, r: env.simpleById.get(s.id)! }));
  (w.bank ?? []).forEach(
    (s, i) => (map[`${s.day}-${s.meal}`] = { kind: "bank", i, r: bankRecipe(env, s.id)! }),
  );
  return map;
}

export function activeMains(env: Env, w: WeekPlan, pm: PortionModel) {
  const m = monthOf(w.start);
  return w.groups.map((g, i) => {
    const meals = g.meals.filter((x) => !isRemoved(w, x.day, x.meal));
    const P = meals.reduce((s, x) => s + mealPd(w, pm, x.day, x.meal), 0);
    const base = env.mainById.get(g.id)!;
    const doubled = (w.doubles ?? []).includes(i) && base.freeze;
    return { i, r: resolve(env, base, m), meals, allMeals: g.meals, P, doubled, cookP: doubled ? P * 2 : P };
  });
}

export function activeSoup(env: Env, w: WeekPlan, pm: PortionModel) {
  if (!w.soup) return null;
  const days = w.soup.days.filter((d) => !isRemoved(w, d, "dinner"));
  return {
    r: resolve(env, env.soupById.get(w.soup.id)!, monthOf(w.start)),
    days,
    P: days.reduce((s, d) => s + mealPd(w, pm, d, "dinner"), 0),
  };
}

export const activeSimples = (env: Env, w: WeekPlan) =>
  w.simples.map((s, i) => ({
    i,
    day: s.day,
    r: env.simpleById.get(s.id)!,
    on: !isRemoved(w, s.day, "dinner"),
  }));

export const activeCake = (env: Env, w: WeekPlan, cakeOn: boolean): Cake | null =>
  cakeOn && w.cake ? (env.cakeById.get(w.cake) ?? null) : null;

export const WEEKEND_SLOTS: [number, Meal][] = [
  [6, "lunch"],
  [6, "dinner"],
  [7, "lunch"],
  [7, "dinner"],
];

export function weekendItems(env: Env, w: WeekPlan) {
  const m = monthOf(w.start);
  return WEEKEND_SLOTS.flatMap(([d, meal]) => {
    const id = w.weekend?.[`${d}-${meal}`];
    const base = id ? anyRecipe(env, id) : null;
    return base ? [{ d, m: meal, k: `${d}-${meal}`, id: id!, r: resolve(env, base, m) }] : [];
  });
}
