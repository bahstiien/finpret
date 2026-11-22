import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { ingredientChip, mentionedIngredients, scaleText } from "./step-details";

describe("détails des étapes de session", () => {
  it("repère les ingrédients cités par placeholder ou par leur nom", () => {
    const text =
      "Remets la viande. Ajoute {haricotsrouges} de haricots rouges, l'oignon, l'ail et 1 c.s. d'huile.";
    const found = mentionedIngredients(LIB, text, [
      "boeuf",
      "haricotsrouges",
      "oignon",
      "ail",
      "huile",
      "cumin",
    ]);
    expect([...found].sort()).toEqual(["ail", "boeuf", "haricotsrouges", "huile", "oignon"]);
  });

  it("« les légumes » renvoie aux légumes de saison", () => {
    const found = mentionedIngredients(
      LIB,
      "Mets les légumes au four.",
      ["poulet", "courgette", "poivron"],
      ["courgette", "poivron"],
    );
    expect([...found].sort()).toEqual(["courgette", "poivron"]);
  });

  it("« la viande » renvoie à la viande du plat", () => {
    const found = mentionedIngredients(LIB, "Mets la viande et l'oignon dans la cocotte.", [
      "paleron",
      "oignon",
      "carotte",
    ]);
    expect([...found].sort()).toEqual(["oignon", "paleron"]);
  });

  it("met à l'échelle les quantités écrites en dur, pas les durées ni les températures", () => {
    expect(
      scaleText(
        "1 c.s. d'huile, 100 ml d'eau, 2 gousses d'ail, 12 min à 190 °C, en 2 fois, cubes de 3 cm.",
        1.5,
      ),
    ).toBe("1,5 c.s. d'huile, 150 ml d'eau, 3 gousses d'ail, 12 min à 190 °C, en 2 fois, cubes de 3 cm.");
    expect(scaleText("2 gousses d'ail, 1 c.c. de cumin", 0.5)).toBe("1 gousse d'ail, ½ c.c. de cumin");
    expect(scaleText("2 c.s. d'huile", 1)).toBe("2 c.s. d'huile");
  });

  it("affiche un libellé court avec la quantité", () => {
    expect(ingredientChip(LIB, "oignon", 2)).toBe("2 oignons");
    expect(ingredientChip(LIB, "ail", 3)).toBe("Ail : 3 gousses");
    expect(ingredientChip(LIB, "riz", 250)).toBe("Riz : 250 g");
  });
});
