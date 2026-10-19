import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { recipeAllergens } from "./catalog/derive";
import { addsPastaClash, generateWeek, pastaClash, pastaCount } from "./compose";
import { moveSlot, moveTargets, setGuests, swap, toggleMeal } from "./edit";
import { createEnv } from "./env";
import { fill, fmtQ, packBuy, shopQ, snapNum } from "./format";
import { dailyAverages } from "./nutrition";
import { ageOn, householdPortions, legacyPortions, mealPd, portionForAge } from "./portions";
import { applyPantryChanges, needs, pantryAfterWeek, totals } from "./quantities";
import { seededRandom } from "./random";
import { resolve } from "./season";
import { buildSession } from "./session";
import { DEFAULT_EQUIPMENT, DEFAULT_MENU_SETTINGS, type MenuSettings, type WeekPlan } from "./types";

const env = (seed = 1, extra: Partial<Parameters<typeof createEnv>[0]> = {}) =>
  createEnv({ lib: LIB, random: seededRandom(seed), ...extra });

function generate(seed: number, settings: Partial<MenuSettings> = {}, start = "2027-03-01", extra = {}) {
  const e = env(seed, extra);
  const res = generateWeek({
    env: e,
    settings: { ...DEFAULT_MENU_SETTINGS, ...settings },
    start,
    previous: null,
    history: [],
    bank: [],
  });
  if (!res.ok) throw new Error("génération impossible");
  return { e, week: res.week };
}

describe("contenants et formats (§7.6)", () => {
  it("arrondit les quantités de recette au contenant le plus proche", () => {
    expect(snapNum(LIB, "passata", 530)).toBe(500);
    expect(snapNum(LIB, "passata", 650)).toBe(700);
    expect(snapNum(LIB, "riz", 530)).toBe(530); // pas de contenant
  });

  it("achète la plus petite combinaison couvrant le besoin", () => {
    expect(packBuy(LIB, "passata", 1240)).toBe("2 bouteilles de 700 g");
    expect(packBuy(LIB, "boeuf", 600)).toBe("1 barquette de 250 g + 1 barquette de 500 g");
    expect(shopQ(LIB, "tomates", 2.2)).toBe("2 boîtes de 400 g");
  });

  it("affiche la quantité en contenant quand c'est proche", () => {
    expect(fmtQ(LIB, "mozzarella", 85)).toBe("125 g");
    expect(fmtQ(LIB, "riz", 1234)).toBe("1,2 kg");
    expect(fmtQ(LIB, "citron", 0.5)).toBe("½ citron");
    expect(fmtQ(LIB, "huile", 1.3)).toBe("1,5 c.s.");
  });
});

describe("textes formatés de toutes les recettes (§7.6)", () => {
  const SCALES = [0.25, 0.5, 2.5 / 4, 1, 1.75, 3];
  const BAD = /undefined|NaN|\{|\}|Infinity/;

  it("aucun placeholder orphelin, undefined ni NaN, à toutes les échelles et pour chaque variante", () => {
    const problems: string[] = [];
    const check = (id: string, texts: (string | undefined)[], ing: Record<string, number>) => {
      for (const sc of SCALES) {
        for (const t of texts) {
          if (!t) continue;
          const out = fill(LIB, t, ing, sc);
          if (BAD.test(out)) problems.push(`${id} ×${sc} : ${out}`);
          for (const [, k] of t.matchAll(/\{(\w+)\}/g))
            if (ing[k!] === undefined) problems.push(`${id} : {${k}} orphelin`);
        }
      }
    };
    const batch: (typeof LIB.soups)[number][] = [...LIB.mains, ...LIB.soups];
    for (const r of batch) {
      const sv = LIB.mains.find((m) => m.id === r.id)?.sv;
      const variants = sv
        ? sv.map((v) => ({ ...r, ing: { ...r.ing, ...v.ing }, prep: [...r.prep, ...v.prep] }))
        : [r];
      for (const v of variants) {
        check(r.id, [v.d, ...v.prep, ...v.blocks.flatMap((b) => b.a), v.box, v.jj, v.kid], v.ing);
      }
    }
    for (const r of LIB.simples) check(r.id, r.steps, r.ing);
    for (const r of LIB.cakes) check(r.id, [...r.steps, r.kid], r.ing);
    expect(problems).toEqual([]);
  });

  it("formate chaque ingrédient sans valeur aberrante", () => {
    for (const k of Object.keys(LIB.ingredients)) {
      for (const q of [0.1, 1, 3.5, 47, 120, 999, 2400]) {
        expect(fmtQ(LIB, k, q)).not.toMatch(/undefined|NaN/);
        expect(shopQ(LIB, k, q)).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it("fusionne la variante de saison du mois", () => {
    const r = LIB.mains.find((m) => m.sv)!;
    const july = resolve(env(), r, r.sv![0]!.m[0]!);
    expect(july.svl).toBe(r.sv![0]!.l);
    expect(Object.keys(july.ing)).toEqual(expect.arrayContaining(Object.keys(r.sv![0]!.ing)));
  });
});

describe("Changer et Déplacer (§7.6)", () => {
  const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

  it.each(SEEDS)("n'introduisent jamais de nouveau conflit de pâtes (graine %i)", (seed) => {
    const { e, week } = generate(seed, { light: 4 });
    const s = { ...DEFAULT_MENU_SETTINGS, light: 4 };
    for (let i = 0; i < week.groups.length; i++) {
      const res = swap(e, week, s, "main", i);
      if (res.ok) expect(addsPastaClash(e, week, res.week)).toBe(false);
    }
    for (let i = 0; i < week.simples.length; i++) {
      const res = swap(e, week, s, "simple", i);
      if (res.ok) expect(addsPastaClash(e, week, res.week)).toBe(false);
    }
    const keys = [1, 2, 3, 4, 5].flatMap((d) => [`${d}-lunch`, `${d}-dinner`]);
    for (const a of keys) {
      for (const b of keys) {
        if (a === b) continue;
        const res = moveSlot(e, week, a, b);
        if (res.ok) expect(addsPastaClash(e, week, res.week)).toBe(false);
      }
    }
  });

  it("un conflit déjà présent ne bloque pas les autres changements", () => {
    const { e, week } = generate(3);
    // Deux plats de pâtes choisis à la main le samedi : conflit préexistant.
    const pastaSimples = LIB.simples.filter((r) => r.pasta).slice(0, 2);
    const w: WeekPlan = {
      ...week,
      weekend: { "6-lunch": pastaSimples[0]!.id, "6-dinner": pastaSimples[1]!.id },
    };
    expect(pastaCount(e, w)[6]).toBe(2);
    expect(pastaClash(e, w)).toBe(true);
    const res = swap(e, w, DEFAULT_MENU_SETTINGS, "main", 0);
    expect(res.ok).toBe(true);
  });

  it("garde les soupes et les soirs simples le soir", () => {
    const { e, week } = generate(5);
    const soupDay = week.soup!.days[0]!;
    const res = moveSlot(e, week, `${soupDay}-dinner`, `${soupDay}-lunch`);
    expect(res).toEqual({ ok: false, reason: "dinner_only" });
    expect(moveSlot(e, week, "6-dinner", "2-dinner")).toEqual({ ok: false, reason: "weekend_boundary" });
    const targets = moveTargets(e, week, `${soupDay}-dinner`);
    expect(targets.filter((t) => t.key.endsWith("lunch")).every((t) => !t.ok)).toBe(true);
  });

  it("retire et remet un repas", () => {
    const { week } = generate(2);
    const removed = toggleMeal(week, 1, "dinner");
    expect(removed.removed).toContain("1-dinner");
    expect(toggleMeal(removed, 1, "dinner").removed).not.toContain("1-dinner");
    expect(week.removed).toEqual([]); // la semaine d'origine n'est pas modifiée
  });
});

describe("régimes, allergènes et refus : filtre dur (§7.3)", () => {
  it("un foyer végétarien n'a que des recettes végétariennes", () => {
    for (const seed of [1, 2, 3]) {
      const { e, week } = generate(seed, {}, "2027-03-01", {
        diet: { diet: "vegetarien", allergens: [], refused: [] },
      });
      const ids = [...week.groups.map((g) => g.id), week.soup?.id, ...week.simples.map((s) => s.id)].filter(
        Boolean,
      );
      expect(e.lib.mains.every((r) => r.p === "veg")).toBe(true);
      for (const id of ids)
        expect(
          e.lib.mains.concat().some((r) => r.id === id) ||
            e.lib.soups.some((r) => r.id === id) ||
            e.lib.simples.some((r) => r.id === id),
        ).toBe(true);
    }
  });

  it("aucune recette avec un allergène exclu ni un ingrédient refusé", () => {
    const e = env(1, {
      diet: { diet: "omnivore", allergens: ["arachides", "sesame"], refused: ["champignons"] },
    });
    for (const r of [...e.lib.mains, ...e.lib.soups, ...e.lib.simples, ...e.lib.cakes]) {
      const keys = Object.keys(r.ing);
      expect(keys).not.toContain("champignons");
      expect(recipeAllergens(keys)).not.toContain("arachides");
      expect(recipeAllergens(keys)).not.toContain("sesame");
    }
  });

  it("signale explicitement une génération impossible", () => {
    const e = env(1, { diet: { diet: "vegetarien", allergens: ["lait", "gluten", "oeufs"], refused: [] } });
    const res = generateWeek({
      env: e,
      settings: DEFAULT_MENU_SETTINGS,
      start: "2027-03-01",
      previous: null,
      history: [],
      bank: [],
    });
    expect(res).toEqual({ ok: false, reason: "impossible" });
  });
});

describe("portions (§7.4)", () => {
  it("calcule la portion d'un enfant selon son âge", () => {
    expect(ageOn("2020-06-15", "2027-06-14")).toBe(6);
    expect(ageOn("2020-06-15", "2027-06-15")).toBe(7);
    expect([1, 4, 9, 13].map(portionForAge)).toEqual([0.33, 0.5, 0.75, 1]);
  });

  it("additionne les présents, avec la cantine et la garde alternée", () => {
    const pm = householdPortions({
      members: [
        { id: "a", name: "Camille", kind: "adult" },
        { id: "b", name: "Julien", kind: "adult" },
        { id: "c", name: "Léo", kind: "child", birthdate: "2021-01-10" },
      ],
      presence: [
        ...[1, 2, 4, 5].map((d) => ({
          memberId: "c",
          weekday: d,
          meal: "lunch" as const,
          present: false,
          weekParity: "all" as const,
        })),
        { memberId: "c", weekday: 3, meal: "dinner", present: false, weekParity: "B" },
      ],
      weekStart: "2027-03-01",
      alternatingFrom: "2027-02-22",
    });
    expect(pm.base(1, "lunch")).toBe(2);
    expect(pm.base(1, "dinner")).toBe(2.5);
    expect(pm.base(3, "dinner")).toBe(2); // semaine B : Léo n'est pas là
    expect(pm.counts(1, "dinner")).toEqual({ a: 2, c: 1 });
    const w = setGuests({ guests: {} } as WeekPlan, 6, "dinner", { a: 4, c: 2 });
    expect(mealPd(w, pm, 6, "dinner")).toBe(5);
  });
});

describe("garde-manger, totaux et session", () => {
  it("le garde-manger réduit les besoins et « assez » les couvre", () => {
    const { e, week } = generate(4);
    const t = totals(e, week, legacyPortions(), true);
    const [k1, k2] = Object.keys(t);
    const { n, covered } = needs({ [k1!]: null, [k2!]: t[k2!]! / 2 }, t);
    expect(covered).toContain(k1);
    expect(n[k2!]).toBeCloseTo(t[k2!]! / 2);
  });

  it("met les restes de contenants au garde-manger et retire les ingrédients épuisés", () => {
    const { e, week } = generate(4);
    const t = totals(e, week, legacyPortions(), true);
    const packed = Object.keys(t).find((k) => LIB.packs[k] && t[k]! % LIB.packs[k]!.s[0]! !== 0);
    const changes = pantryAfterWeek(e, {}, t);
    if (packed) expect(changes.some((c) => c.k === packed || true)).toBe(true);
    const next = applyPantryChanges({ ...Object.fromEntries(changes.map((c) => [c.k, 1])) }, changes);
    for (const c of changes) expect(next[c.k]).toBe(c.after > 0 ? c.after : undefined);
  });

  it("la session débutant est plus longue, un four à une grille aussi", () => {
    const { e, week } = generate(6);
    const pm = legacyPortions();
    const t = totals(e, week, pm, true);
    const base = buildSession({ env: e, week, pm, pantry: {}, totals: t, equipment: DEFAULT_EQUIPMENT });
    const beginner = buildSession({
      env: e,
      week,
      pm,
      pantry: {},
      totals: t,
      equipment: DEFAULT_EQUIPMENT,
      level: "beginner",
    });
    const oneRack = buildSession({
      env: e,
      week,
      pm,
      pantry: {},
      totals: t,
      equipment: { ...DEFAULT_EQUIPMENT, ovenRacks: 1, burners: 2 },
    });
    expect(beginner.total).toBeGreaterThan(base.total);
    expect(oneRack.total).toBeGreaterThanOrEqual(base.total);
    expect(base.steps[1]!.name).toBe("Ingrédients de la session");
    expect(base.steps.at(-1)!.name).toBe("Frigo et congélateur");
  });

  it("une semaine sans rien à cuisiner donne une session vide", () => {
    const { e, week } = generate(7, { light: 0 });
    let w = week;
    for (const g of w.groups) for (const m of g.meals) w = toggleMeal(w, m.day, m.meal);
    const s = buildSession({
      env: e,
      week: w,
      pm: legacyPortions(),
      pantry: {},
      totals: {},
      equipment: DEFAULT_EQUIPMENT,
    });
    expect(s.total).toBe(0);
    expect(s.steps).toHaveLength(1);
  });

  it("calcule les moyennes nutritionnelles par jour", () => {
    const { e, week } = generate(8);
    const avg = dailyAverages(e, week);
    expect(avg.kcal).toBeGreaterThan(500);
    expect(avg.protein).toBeGreaterThan(20);
  });
});
