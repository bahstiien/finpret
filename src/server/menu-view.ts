import "server-only";
import { portionCost } from "@/engine/cost";
import type { Env } from "@/engine/env";
import { fill, fmtP, fmtQ } from "@/engine/format";
import { originOf } from "@/engine/origins";
import { guestsOf, mealPd, type PortionModel } from "@/engine/portions";
import type { Meal, WeekPlan } from "@/engine/types";
import { activeMains, activeSimples, activeSoup, isRemoved, slotMap, weekendItems } from "@/engine/week";
import { fr } from "@/i18n/fr";
import { addDays, dayIndex, isoWeekday } from "@/lib/dates";
import { recipePhoto, type RecipePhoto } from "@/seo/images";
import type { HouseholdContext } from "./household-context";

/** Vue de l'écran Menu (§8.1), calculée côté serveur à partir du plan et du moteur. */

export type Flag = { code: string; emoji: string; name: string } | null;

export type MealView = {
  key: string;
  day: number;
  meal: Meal;
  kind: "main" | "soup" | "simple" | "bank" | "weekend";
  /** Index du plat dans son groupe (groups, simples ou bank) pour Changer. */
  index: number;
  recipeId: string;
  name: string;
  flag: Flag;
  photo: RecipePhoto | null;
  label: string;
  how: string;
  guests: string;
  guestsCustom: boolean;
  counts: { a: number; c: number };
  favorite: boolean;
  removed: boolean;
  /** 1 (très facile) à 4 (technique). */
  difficulty: number;
};

export type DayView = { day: number; iso: string; meals: MealView[]; tonight: string | null; thaw: string[] };

export type DishCard = {
  kind: "main" | "soup" | "simple" | "bank";
  index: number;
  recipeId: string;
  name: string;
  flag: Flag;
  photo: RecipePhoto | null;
  detail: string;
  rating: 1 | -1 | null;
  kids: boolean;
  long: boolean;
  doubled: boolean;
  canDouble: boolean;
};

export type RecipeDetail = {
  recipeId: string;
  title: string;
  name: string;
  flag: Flag;
  photo: RecipePhoto | null;
  portions: string;
  /** Coût indicatif d'une portion, null si non calculable. */
  cost: string | null;
  description: string | null;
  ingredients: string[];
  steps: string[];
  notes: string[];
  /** 1 (très facile) à 4 (technique). */
  difficulty: number;
};

export type GridCell = {
  day: number;
  meal: Meal;
  state: "on" | "off" | "removed" | "empty" | "set";
  name: string | null;
  /** Convives du créneau (« Qui est à table ? ») ; custom si modifiés pour cette semaine. */
  counts: { a: number; c: number };
  custom: boolean;
};

export type MenuView = {
  weekId: string;
  start: string;
  todayIndex: number;
  days: DayView[];
  plannedMeals: number;
  grid: GridCell[];
  dishes: DishCard[];
  weekend: { key: string; day: number; meal: Meal; recipeId: string; name: string; flag: Flag }[];
  cake: { id: string; name: string; parts: string; day: number; steps: string[]; kid: string } | null;
  recipes: RecipeDetail[];
};

export const flagOf = (code?: string | null): Flag => {
  const o = originOf(code);
  return o && code ? { code, emoji: o.flag, name: o.name } : null;
};

function guestsText(ctx: HouseholdContext, pm: PortionModel, w: WeekPlan, day: number, meal: Meal) {
  const custom = guestsOf(w, day, meal);
  const counts = custom ?? pm.counts(day, meal);
  const g = fr.menuView.guests;
  if (!custom) {
    const active = ctx.members.filter((m) => !m.archived);
    if (counts.a + counts.c === active.length && active.length > 1)
      return { text: g.family, counts, custom: false };
  }
  return { text: g.count(counts.a, counts.c), counts, custom: !!custom };
}

/** Temps d'une recette cuisinée le jour même (week-end). */
function freshTime(r: {
  steps?: string[];
  prepMin?: number;
  blocks?: { active: number; passive: number; wait?: false }[];
}) {
  if (r.steps) return fr.menuView.simpleTime;
  let t = r.prepMin || 5;
  for (const b of r.blocks ?? []) t += b.active + (b.wait === false ? 0 : b.passive || 0);
  return fr.menuView.about(Math.round(t / 5) * 5);
}

export function buildMenuView(
  ctx: HouseholdContext,
  env: Env,
  row: { id: string; start_date: string; plan: WeekPlan },
  pm: PortionModel,
  today: string,
): MenuView {
  const w = row.plan;
  const lib = env.lib;
  const t = fr.menuView;
  const map = slotMap(env, w);
  const todayIndex = dayIndex(w.start, today);
  const fav = (id: string) => env.ratings[id] === 1;

  const fresh = weekendItems(env, w);
  const days: DayView[] = [];
  for (let day = 1; day <= 7; day++) {
    const meals: MealView[] = [];
    for (const meal of ["lunch", "dinner"] as const) {
      const key = `${day}-${meal}`;
      const removed = isRemoved(w, day, meal);
      const g = guestsText(ctx, pm, w, day, meal);
      const sc = mealPd(w, pm, day, meal) / 4;
      const own = fresh.find((it) => it.d === day && it.m === meal);
      if (day <= 5 && !own) {
        const s = map[key];
        if (!s) continue;
        const r = s.r;
        const how =
          s.kind === "simple"
            ? s.r.steps.map((x) => fill(lib, x, s.r.ing, sc)).join(" ")
            : (s.kind === "bank" ? t.fromFreezer : "") +
              ("jj" in r && r.jj ? fill(lib, r.jj, r.ing, sc) : t.reheat);
        const label =
          meal === "lunch"
            ? s.kind === "simple"
              ? t.labels.lunchSimple
              : t.labels.lunch
            : s.kind === "simple"
              ? t.labels.dinnerSimple
              : s.kind === "bank"
                ? t.labels.dinnerBank
                : t.labels.dinner;
        meals.push({
          key,
          day,
          meal,
          kind: s.kind,
          index: "i" in s ? s.i : 0,
          recipeId: r.id,
          name: r.s,
          photo: recipePhoto(r.id, r.s),
          flag: flagOf(r.o),
          label,
          how,
          guests: g.text,
          guestsCustom: g.custom,
          counts: g.counts,
          favorite: fav(r.id),
          removed,
          difficulty: r.diff,
        });
      } else {
        const x = own;
        if (!x) continue;
        // Recette cuisinée le jour même : étapes du soir simple, ou préparation et cuisson du plat (`freshSteps`).
        const steps =
          "steps" in x.r
            ? x.r.steps
            : [...x.r.prep, ...x.r.blocks.flatMap((b) => b.a), ...(x.r.jj ? [x.r.jj] : [])];
        meals.push({
          key,
          day,
          meal,
          kind: "weekend",
          index: 0,
          recipeId: x.id,
          name: x.r.s,
          photo: recipePhoto(x.r.id, x.r.s),
          flag: flagOf(x.r.o),
          label: `${fr.meals[meal]} · ${freshTime(x.r)}`,
          how: steps.map((s) => fill(lib, s, x.r.ing, sc)).join(" "),
          guests: g.text,
          guestsCustom: g.custom,
          counts: g.counts,
          favorite: fav(x.id),
          removed: false,
          difficulty: x.r.diff,
        });
      }
    }
    // « Ce soir » : la première phrase de la consigne du dîner ; « Avant de dormir » : ce qui sort du congélateur pour demain.
    const dinner = meals.find((m) => m.meal === "dinner" && !m.removed);
    const tonight = dinner
      ? dinner.kind === "simple" || dinner.kind === "weekend"
        ? `${dinner.name}, ${dinner.label.split(" · ")[1]}`
        : dinner.how.split(/\.\s/)[0]!.replace(/\.$/, "")
      : null;
    const thaw: string[] = [];
    if (day < 5) {
      for (const meal of ["lunch", "dinner"] as const) {
        const s = map[`${day + 1}-${meal}`];
        if (!s || isRemoved(w, day + 1, meal)) continue;
        if (s.kind === "bank" || (s.kind !== "simple" && day + 1 > s.r.fridge))
          thaw.push(s.r.s.toLowerCase());
      }
    }
    days.push({ day, iso: addDays(w.start, day - 1), meals, tonight, thaw: [...new Set(thaw)] });
  }

  const grid: GridCell[] = [];
  for (let day = 1; day <= 7; day++) {
    for (const meal of ["lunch", "dinner"] as const) {
      const key = `${day}-${meal}`;
      if (day > 5) {
        const id = w.weekend?.[key];
        const r = id ? (env.mainById.get(id) ?? env.soupById.get(id) ?? env.simpleById.get(id)) : null;
        const g = guestsText(ctx, pm, w, day, meal);
        grid.push({ day, meal, state: r ? "set" : "empty", name: r?.s ?? null, counts: g.counts, custom: g.custom });
      } else {
        const s = map[key];
        const own = fresh.find((it) => it.d === day && it.m === meal);
        const g = guestsText(ctx, pm, w, day, meal);
        grid.push({
          day,
          meal,
          state: own ? "set" : !s ? "off" : isRemoved(w, day, meal) ? "removed" : "on",
          name: own ? own.r.s : (s?.r.s ?? null),
          counts: g.counts,
          custom: g.custom,
        });
      }
    }
  }

  const mains = activeMains(env, w, pm);
  const so = activeSoup(env, w, pm);
  const rating = (id: string) => (env.ratings[id] ?? null) as 1 | -1 | null;
  const flags = (id: string) => ({ kids: !!env.feedback[id]?.kids, long: !!env.feedback[id]?.long });
  const dishes: DishCard[] = [
    ...mains.map((x) => ({
      kind: "main" as const,
      index: x.i,
      recipeId: x.r.id,
      name: x.r.s,
      photo: recipePhoto(x.r.id, x.r.s),
      flag: flagOf(x.r.o),
      detail: t.portions(fmtP(x.cookP), x.doubled),
      rating: rating(x.r.id),
      ...flags(x.r.id),
      doubled: x.doubled,
      canDouble: x.r.freeze && ctx.settings.equipment.freezer,
    })),
    ...(so
      ? [
          {
            kind: "soup" as const,
            index: 0,
            recipeId: so.r.id,
            name: so.r.s,
            photo: recipePhoto(so.r.id, so.r.s),
            flag: flagOf(so.r.o),
            detail: t.soup,
            rating: rating(so.r.id),
            ...flags(so.r.id),
            doubled: false,
            canDouble: false,
          },
        ]
      : []),
    ...activeSimples(env, w).map((s) => ({
      kind: "simple" as const,
      index: s.i,
      recipeId: s.r.id,
      name: s.r.s,
      photo: recipePhoto(s.r.id, s.r.s),
      flag: flagOf(s.r.o),
      detail: t.simpleOn(fr.days[s.day - 1]!),
      rating: rating(s.r.id),
      ...flags(s.r.id),
      doubled: false,
      canDouble: false,
    })),
    ...(w.bank ?? []).map((b, i) => {
      const r = env.mainById.get(b.id) ?? env.soupById.get(b.id)!;
      return {
        kind: "bank" as const,
        index: i,
        recipeId: b.id,
        name: r.s,
        photo: recipePhoto(r.id, r.s),
        flag: flagOf(r.o),
        detail: t.bankOn(`${fr.days[b.day - 1]} ${fr.meals[b.meal].toLowerCase()}`),
        rating: rating(b.id),
        ...flags(b.id),
        doubled: false,
        canDouble: false,
      };
    }),
  ];

  const recipes: RecipeDetail[] = [];
  const ingLines = (ing: Record<string, number>, sc: number) =>
    Object.keys(ing).map((k) => `${lib.ingredients[k]?.l ?? k} : ${fmtQ(lib, k, ing[k]! * sc)}`);
  const costOf = (ing: Record<string, number>) => {
    const c = portionCost(lib, ing);
    return c ? t.cost(c.eur, c.missing.length > 0) : null;
  };
  for (const x of mains) {
    if (!x.P) continue;
    const r = x.r;
    recipes.push({
      recipeId: r.id,
      title: t.recipeKinds.main,
      name: r.n,
      photo: recipePhoto(r.id, r.n),
      flag: flagOf(r.o),
      portions: t.portions(fmtP(x.cookP), x.doubled),
      cost: costOf(r.ing),
      description: r.d,
      ingredients: ingLines(r.ing, x.cookP / 4),
      steps: [...r.prep, ...r.blocks.flatMap((b) => b.a)].map((s) => fill(lib, s, r.ing, x.cookP / 4)),
      notes: [t.keeps(r.fridge, r.freeze), ...(r.jj ? [t.dayJ(fill(lib, r.jj, r.ing, 2 / 4))] : [])],
      difficulty: r.diff,
    });
  }
  if (so && so.P) {
    const r = so.r;
    recipes.push({
      recipeId: r.id,
      title: t.recipeKinds.soup,
      name: r.n,
      photo: recipePhoto(r.id, r.n),
      flag: flagOf(r.o),
      portions: t.portions(fmtP(so.P), false),
      cost: costOf(r.ing),
      description: r.d,
      ingredients: ingLines(r.ing, so.P / 4),
      steps: [...r.prep, ...r.blocks.flatMap((b) => b.a)].map((s) => fill(lib, s, r.ing, so.P / 4)),
      notes: [t.keeps(r.fridge, r.freeze)],
      difficulty: r.diff,
    });
  }
  for (const s of activeSimples(env, w).filter((x) => x.on)) {
    const sc = mealPd(w, pm, s.day, "dinner") / 4;
    recipes.push({
      recipeId: s.r.id,
      title: t.recipeKinds.simple,
      name: s.r.n,
      photo: recipePhoto(s.r.id, s.r.n),
      flag: flagOf(s.r.o),
      portions: `${fr.days[s.day - 1]} soir`,
      cost: costOf(s.r.ing),
      description: t.simpleLead,
      ingredients: ingLines(s.r.ing, sc),
      steps: s.r.steps.map((x) => fill(lib, x, s.r.ing, sc)),
      notes: [],
      difficulty: s.r.diff,
    });
  }

  const cakeRecipe = ctx.settings.menu.cake.enabled && w.cake ? env.cakeById.get(w.cake) : null;
  const plannedMeals =
    grid.filter((c) => c.day <= 5 && c.state === "on").length + grid.filter((c) => c.state === "set").length;

  return {
    weekId: row.id,
    start: w.start,
    todayIndex,
    days,
    plannedMeals,
    grid,
    dishes,
    weekend: weekendItems(env, w).map((x) => ({
      key: x.k,
      day: x.d,
      meal: x.m,
      recipeId: x.id,
      name: x.r.s,
      flag: flagOf(x.r.o),
    })),
    cake: cakeRecipe
      ? {
          id: cakeRecipe.id,
          name: cakeRecipe.n,
          parts: cakeRecipe.parts,
          day: ctx.settings.menu.cake.day,
          steps: cakeRecipe.steps.map((s) => fill(lib, s, cakeRecipe.ing, 1)),
          kid: cakeRecipe.kid,
        }
      : null,
    recipes,
  };
}

/** Jeudi ou plus tard : on peut préparer la semaine suivante (§8.1). */
export const canPrepareNext = (today: string) => [4, 5, 6, 7].includes(isoWeekday(today));
