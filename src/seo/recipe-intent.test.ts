import { describe, expect, it } from "vitest";
import { displayName, RECIPES } from "./catalog";
import { toCard } from "./recipe-filter";
import { search, understand, withoutHit } from "./recipe-intent";

const cards = RECIPES.map((r) => toCard(r, displayName(r)));

const labels = (q: string) => understand(q).hits.map((h) => h.label);

describe("recherche intelligente de /recettes", () => {
  it("comprend pays, envie et difficulté dans une phrase", () => {
    const u = understand("Un plat italien réconfortant et facile");
    expect(u.intent).toMatchObject({ countries: ["Italie"], types: ["reconfortant"], difficulty: [1, 2] });
    expect(u.words).toEqual([]);
    expect(labels("Un plat italien réconfortant et facile")).toEqual(["Italie", "Réconfortant", "Facile"]);
  });

  it("accorde pluriels et féminins, et préfère l'expression la plus longue", () => {
    expect(understand("cuisine italienne").intent.countries).toEqual(["Italie"]);
    expect(understand("soupes très faciles").intent).toMatchObject({ kind: "soupe", difficulty: [1, 1] });
    expect(understand("batch cooking").hits).toHaveLength(1);
  });

  it("garde les mots inconnus pour chercher dans les ingrédients", () => {
    const u = understand("gratin de courgettes végétarien");
    expect(u.intent.veg).toBe(true);
    expect(u.words).toEqual(["gratin", "courgettes"]);
  });

  it("lit une durée, une saison, un mois, une région", () => {
    expect(understand("poulet en 20 min").intent).toMatchObject({ maxMin: 20, types: ["volaille"] });
    expect(understand("prêt en 45min").intent.maxMin).toBe(45);
    expect(understand("quelque chose de rapide").intent.maxMin).toBe(30);
    expect(understand("soupe d'hiver à congeler").intent).toMatchObject({
      kind: "soupe",
      months: [12, 1, 2],
      freeze: true,
    });
    expect(understand("en mars").intent.months).toEqual([3]);
    expect(understand("asiatique").intent.countries).toEqual(
      expect.arrayContaining(["Japon", "Inde", "Thaïlande", "Chine", "Corée"]),
    );
  });

  it("retire un morceau compris de la demande", () => {
    const q = "plat italien réconfortant aux lentilles";
    const hit = understand(q).hits.find((h) => h.label === "Italie")!;
    expect(withoutHit(q, hit)).toBe("plat réconfortant aux lentilles");
  });

  it("ne coupe pas les mots sur la ponctuation", () => {
    expect(labels("Plats italiens, réconfortants & faciles !")).toEqual(["Italie", "Réconfortant", "Facile"]);
  });

  it("cherche dans le vrai catalogue", () => {
    const found = search(cards, "un plat italien réconfortant et facile", 1).recipes;
    expect(found.length).toBeGreaterThan(5);
    expect(
      found.every((c) => c.country === "Italie" && c.types.includes("reconfortant") && c.difficulty <= 2),
    ).toBe(true);
    expect(
      search(cards, "gratin végétarien", 1).recipes.every((c) => c.vegetarian && c.text.includes("gratin")),
    ).toBe(true);
  });

  it("ignore un mot absent de tout le catalogue au lieu de tout vider", () => {
    const r = search(cards, "plat italien réconfortant stp", 1);
    expect(r.ignored).toEqual(["stp"]);
    expect(r.recipes.length).toBe(search(cards, "plat italien réconfortant", 1).recipes.length);
  });
});
