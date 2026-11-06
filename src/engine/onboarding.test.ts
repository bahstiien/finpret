import { describe, expect, it } from "vitest";
import { libraryFromSeed } from "./catalog/library";
import { rawSeed } from "./catalog/seed-files";
import { validateSeed } from "./catalog/validate";
import { generateWeek, weekRecipeIds } from "./compose";
import { economyBonus, portionCost } from "./cost";
import { createEnv } from "./env";
import { dietPreset, previewDishes, sportifMinProtein } from "./onboarding";
import { seededRandom } from "./random";
import { DEFAULT_MENU_SETTINGS, type Diet } from "./types";

const lib = libraryFromSeed(validateSeed(rawSeed).seed!);
const DIETS: Diet[] = ["omnivore", "flexitarien", "vegetarien", "pescetarien", "carnivore"];

function generate(diet: Diet, opts: { minProtein?: number; economical?: boolean } = {}, seed = 7) {
  const preset = dietPreset(diet);
  const env = createEnv({
    lib,
    random: seededRandom(seed),
    diet: { diet, allergens: [], refused: [], ...opts },
  });
  const res = generateWeek({
    env,
    settings: { ...DEFAULT_MENU_SETTINGS, proteinCaps: preset.proteinCaps, minVeg: preset.minVeg },
    start: "2027-03-01",
    previous: null,
    history: [],
    bank: [],
  });
  return { env, res };
}

describe("envies de l'onboarding", () => {
  it.each(DIETS)("composent une semaine pour l'alimentation %s, avec ou sans objectifs", (diet) => {
    for (const opts of [{}, { minProtein: sportifMinProtein(diet) }, { economical: true }]) {
      const { res } = generate(diet, opts);
      expect([diet, opts, res.ok]).toEqual([diet, opts, true]);
    }
  });

  it("flexitarien : au moins 2 plats végétariens, carnivore : un seul", () => {
    for (const seed of [1, 2, 3]) {
      const flexi = generate("flexitarien", {}, seed);
      const carni = generate("carnivore", {}, seed);
      if (!flexi.res.ok || !carni.res.ok) throw new Error("génération");
      const veg = (env: typeof flexi.env, ids: string[]) =>
        ids.filter((id) => env.mainById.get(id)?.p === "veg").length;
      expect(
        veg(
          flexi.env,
          flexi.res.week.groups.map((g) => g.id),
        ),
      ).toBeGreaterThanOrEqual(2);
      expect(
        veg(
          carni.env,
          carni.res.week.groups.map((g) => g.id),
        ),
      ).toBeLessThanOrEqual(1);
    }
  });

  it("économique : les plats tirés coûtent en moyenne moins cher", () => {
    const avg = (economical: boolean) => {
      let total = 0;
      let n = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const { res } = generate("omnivore", { economical }, seed);
        if (!res.ok) throw new Error("génération");
        for (const id of weekRecipeIds(res.week)) {
          const r = lib.mains.find((x) => x.id === id);
          const cost = r && portionCost(lib, r.ing);
          if (cost) {
            total += cost.eur;
            n++;
          }
        }
      }
      return total / n;
    };
    expect(avg(true)).toBeLessThan(avg(false));
  });

  it("le bonus économique va de 0,6 pour le moins cher à rien au-delà du coût médian", () => {
    const bonus = economyBonus(lib, lib.mains);
    const values = Object.values(bonus);
    expect(values.length).toBe(Math.floor(lib.mains.length / 2));
    expect(Math.max(...values)).toBeCloseTo(0.6);
    expect(Math.min(...values)).toBeGreaterThan(0);
  });

  it("l'aperçu donne 3 plats distincts, fidèles à l'alimentation et aux objectifs", () => {
    for (const diet of DIETS) {
      for (const goals of [[], ["sportif"], ["economique"], ["sportif", "economique"]] as const) {
        const dishes = previewDishes(lib, diet, goals);
        expect(new Set(dishes.map((d) => d.id)).size).toBe(3);
        if (diet === "vegetarien") expect(dishes.every((d) => d.p === "veg")).toBe(true);
        if (diet === "pescetarien")
          expect(dishes.every((d) => d.p === "veg" || d.p === "poisson")).toBe(true);
        if (goals.includes("sportif" as never))
          expect(dishes.every((d) => d.m[1]! >= sportifMinProtein(diet))).toBe(true);
      }
    }
    expect(previewDishes(lib, "omnivore", [])).toEqual(previewDishes(lib, "omnivore", []));
  });
});
