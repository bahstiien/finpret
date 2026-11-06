import { describe, expect, it } from "vitest";
import { libraryFromSeed } from "./catalog/library";
import { buildCatalogRows } from "./catalog/rows";
import { rawSeed } from "./catalog/seed-files";
import { validateSeed } from "./catalog/validate";
import { portionCost, pricePer, unitPrice } from "./cost";
import type { Library } from "./types";

const { seed, issues } = validateSeed(rawSeed);
const lib = libraryFromSeed(seed!);

const tiny = (prices?: Record<string, number>): Library => ({
  mains: [],
  soups: [],
  simples: [],
  cakes: [],
  ingredients: {},
  packs: {},
  notSeasonal: [],
  aisles: [],
  ...(prices && { prices }),
});

describe("prix de référence", () => {
  it("se lisent au kg pour les grammes, au litre pour les millilitres, sinon à l'unité", () => {
    expect(pricePer("g")).toBe("kg");
    expect(pricePer("ml")).toBe("l");
    expect(pricePer("cs")).toBe("cs");
    expect(unitPrice(12.5, "kg")).toBe(0.0125);
    expect(unitPrice(0.99, "l")).toBe(0.00099);
    expect(unitPrice(0.25, "pc")).toBe(0.25);
  });

  it("couvrent tous les ingrédients du seed, avec la base attendue", () => {
    expect(issues).toEqual([]);
    expect(Object.keys(seed!.prices.prices).sort()).toEqual(Object.keys(seed!.ingredients).sort());
    expect(buildCatalogRows(seed!).prices).toHaveLength(152);
  });

  it("gardent la source des seules estimations hors drive", () => {
    const sourced = Object.entries(seed!.prices.prices).filter(([, p]) => p.source);
    expect(sourced.map(([k]) => k).sort()).toEqual(
      [
        "abricots", "agneau", "artichaut", "fraises", "feves", "melon", "menthe",
        "paleron", "panais", "peche", "rhubarbe", "sesame", "tahini", "topinambour",
      ].sort(),
    );
  });
});

describe("coût par portion", () => {
  it("divise le coût des quantités pour 4 portions", () => {
    const l = tiny({ riz: 0.003, oeufs: 0.25 });
    expect(portionCost(l, { riz: 400, oeufs: 4 })).toEqual({ eur: (1.2 + 1) / 4, missing: [] });
  });

  it("exclut et signale les ingrédients sans prix", () => {
    const l = tiny({ riz: 0.003 });
    expect(portionCost(l, { riz: 400, h_sauce_maison: 100 })).toEqual({ eur: 0.3, missing: ["h_sauce_maison"] });
  });

  it("n'est pas calculé sans prix", () => {
    expect(portionCost(tiny(), { riz: 400 })).toBeNull();
    expect(portionCost(tiny({ riz: 0.003 }), { h_sauce_maison: 100 })).toBeNull();
  });

  it("est complet et plausible pour toutes les recettes du seed", () => {
    const costs = [...lib.mains, ...lib.soups, ...lib.simples].map((r) => portionCost(lib, r.ing)!);
    expect(costs.filter((c) => c.missing.length)).toEqual([]);
    for (const c of costs) {
      expect(c.eur).toBeGreaterThan(0.3);
      expect(c.eur).toBeLessThan(8);
    }
  });
});
