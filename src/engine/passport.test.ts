import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countryLabel, isIsoRegion, newAchievements, normalizeOrigin, seasonOf, type CookRecord } from "./passport";

const cook = (o: Partial<CookRecord>): CookRecord => ({
  recipeId: "r1", cookedOn: "2027-03-14", kind: "main", origin: "jp", isGlobal: true, ...o,
});

describe("passeport", () => {
  it("la première recette d'un pays donne un tampon", () => {
    expect(newAchievements([cook({})], new Set())).toEqual([{ kind: "country", key: "jp" }]);
  });

  it("une recette refaite ne donne pas un second tampon", () => {
    const cooks = [cook({}), cook({ cookedOn: "2027-03-21" })];
    expect(newAchievements(cooks, new Set(["country:jp"]))).toEqual([]);
  });

  it("les recettes privées et les goûters ne comptent pas", () => {
    expect(newAchievements([cook({ isGlobal: false })], new Set())).toEqual([]);
    expect(newAchievements([cook({ kind: "cake" as never })], new Set())).toEqual([]);
  });

  it("tampon de saison à 6 recettes de saison différentes", () => {
    const mk = (i: number, on: string) => cook({ recipeId: `s${i}`, origin: null, cookedOn: on, months: [9, 10, 11] });
    const five = [1, 2, 3, 4, 5].map((i) => mk(i, "2027-09-20"));
    expect(newAchievements(five, new Set())).toEqual([]);
    expect(newAchievements([...five, mk(6, "2027-11-07")], new Set())).toEqual([{ kind: "season", key: "2027-autumn" }]);
    expect(newAchievements([...five, mk(5, "2027-10-01")], new Set())).toEqual([]); // même recette
  });

  it("une variante saisonnière rend la recette de saison", () => {
    const c = Array.from({ length: 6 }, (_, i) =>
      cook({ recipeId: `v${i}`, origin: null, cookedOn: "2027-07-04", variantMonths: [[6, 7, 8]] }),
    );
    expect(newAchievements(c, new Set()).map((a) => a.key)).toEqual(["2027-summer"]);
  });

  it("l'hiver porte l'année de janvier", () => {
    expect(seasonOf("2026-12-20").key).toBe("2027-winter");
    expect(seasonOf("2027-01-10").key).toBe("2027-winter");
  });

  it("libellés français", () => {
    expect(countryLabel("jp")).toBe("Japon");
    expect(countryLabel("gb")).toBe("Royaume-Uni");
  });
});

describe("données du catalogue", () => {
  const read = (f: string) => JSON.parse(readFileSync(`seed/${f}.json`, "utf8")) as { o?: string }[];
  const origins = ["mains", "soups", "simples"].flatMap((f) => read(f).map((r) => normalizeOrigin(r.o)));

  it("toute origine corrigée est un code ISO 3166-1 alpha-2 valide", () => {
    for (const o of origins) if (o) expect(isIsoRegion(o), o).toBe(true);
  });

  it("19 pays après la migration de données", () => {
    expect(new Set(origins.filter(Boolean)).size).toBe(19);
  });
});
