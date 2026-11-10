import { describe, expect, it } from "vitest";
import { libraryFromSeed } from "./catalog/library";
import { rawSeed } from "./catalog/seed-files";
import { validateSeed } from "./catalog/validate";
import { generateWeek } from "./compose";
import { portionCost, weekCost } from "./cost";
import { createEnv } from "./env";
import { legacyPortions } from "./portions";
import { seededRandom } from "./random";
import { DEFAULT_MENU_SETTINGS, type MenuSettings } from "./types";

const LIB = libraryFromSeed(validateSeed(rawSeed).seed!);
const pm = legacyPortions();

function generate(seed: number, settings: Partial<MenuSettings> = {}, withPortions = true) {
  const env = createEnv({ lib: LIB, random: seededRandom(seed) });
  const res = generateWeek({
    env,
    settings: { ...DEFAULT_MENU_SETTINGS, ...settings },
    start: "2027-03-01",
    previous: null,
    history: [],
    bank: [],
    ...(withPortions && { portions: pm }),
  });
  if (!res.ok) throw new Error("génération impossible");
  return { env, res };
}

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
/** Un budget intenable rejette toutes les semaines tirées avant de garder la moins chère : ~1 s par semaine. */
const SLOW = 30_000;

describe("coût estimé d'une semaine", () => {
  it("additionne le coût par portion des plats, de la soupe et des soirs simples aux portions des créneaux", () => {
    const { env, res } = generate(3);
    const w = res.week;
    const eur = (r: { ing: Record<string, number> }) => portionCost(env.lib, r.ing)!.eur;
    let expected = 0;
    for (const g of w.groups)
      expected += eur(env.mainById.get(g.id)!) * g.meals.reduce((n, m) => n + pm.base(m.day, m.meal), 0);
    if (w.soup) expected += eur(env.soupById.get(w.soup.id)!) * w.soup.days.length * pm.base(1, "dinner");
    for (const x of w.simples) expected += eur(env.simpleById.get(x.id)!) * pm.base(x.day, "dinner");
    expect(weekCost(env, w, pm)).toBeCloseTo(expected, 6);
    expect(res.cost).toBeCloseTo(expected, 6);
  });

  it("ne compte pas un repas retiré", () => {
    const { env, res } = generate(3);
    const g = res.week.groups[0]!;
    const m = g.meals[0]!;
    const without = weekCost(env, { ...res.week, removed: [`${m.day}-${m.meal}`] }, pm);
    const eur = portionCost(env.lib, env.mainById.get(g.id)!.ing)!.eur;
    expect(weekCost(env, res.week, pm) - without).toBeCloseTo(eur * pm.base(m.day, m.meal), 6);
  });

  it("n'est pas calculé sans portions", () => {
    expect(generate(3, {}, false).res.cost).toBeNull();
  });
});

describe("budget de la semaine", () => {
  const free = SEEDS.map((seed) => generate(seed).res);
  const costs = free.map((r) => r.cost!).sort((a, b) => a - b);

  it("ne change rien quand il n'est pas réglé (même semaine, même tirage)", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      expect(generate(seed, { budget: 0 }).res.week).toEqual(generate(seed).res.week);
      expect(generate(seed, { budget: 0 }).res.overBudget).toBe(false);
    }
  });

  it(
    "tient un budget serré mais atteignable",
    () => {
      // Le menu libre le moins cher des 20 tirages : un budget que la plupart des tirages libres dépassent.
      const budget = Math.ceil(costs[0]!);
      expect(costs.filter((c) => c > budget).length).toBeGreaterThan(SEEDS.length / 2);
      for (const seed of SEEDS) {
        const { res } = generate(seed, { budget });
        expect(res.overBudget).toBe(false);
        expect(res.cost!).toBeLessThanOrEqual(budget);
      }
    },
    SLOW,
  );

  it(
    "propose la semaine la moins chère trouvée quand le budget est intenable",
    () => {
      for (const seed of SEEDS.slice(0, 3)) {
        const { res } = generate(seed, { budget: 1 });
        expect(res.overBudget).toBe(true);
        expect(res.cost!).toBeGreaterThan(1);
        // Moins chère que le menu libre médian : le repli cherche bien au plus juste.
        expect(res.cost!).toBeLessThan(costs[Math.floor(costs.length / 2)]!);
      }
    },
    SLOW,
  );

  it("garde les autres règles de composition", () => {
    const budget = Math.ceil(costs[0]!);
    for (const seed of SEEDS.slice(0, 5)) {
      const { res } = generate(seed, { budget });
      expect(res.week.groups).toHaveLength(free[seed - 1]!.week.groups.length);
      expect(res.week.simples).toHaveLength(free[seed - 1]!.week.simples.length);
      expect(!!res.week.soup).toBe(!!free[seed - 1]!.week.soup);
    }
  });
});
