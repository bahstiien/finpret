import { describe, expect, it } from "vitest";
import { checkCatalogRecipe, EDITABLE_KINDS, recipeTemplate, suggestRecipeId } from "./admin-recipe";
import { buildCatalogRows } from "./rows";
import { rawSeed } from "./seed-files";
import { validateSeed } from "./validate";

const { seed } = validateSeed(rawSeed);
const rows = buildCatalogRows(seed!);
const known = new Set(Object.keys(seed!.ingredients));
const croque = rows.recipes.find((r) => r.id === "croque")!;

describe("recette du catalogue écrite depuis le back-office", () => {
  it("donne la même ligne que le seed pour toutes les recettes du catalogue", () => {
    for (const row of rows.recipes) {
      if (row.kind === "breakfast") continue;
      const checked = checkCatalogRecipe(row.kind, row.id, row.data, known);
      expect(checked, row.id).toEqual({ ok: true, row });
    }
  });

  it("recalcule régime et allergènes après une modification", () => {
    const data = {
      ...croque.data,
      ing: { oeufs: 4, salade: 1, emmental: 120, painmie: 8 },
      steps: ["Monte {painmie} avec {emmental}.", "Cuis {oeufs} et sers avec {salade}."],
    };
    const checked = checkCatalogRecipe("simple", "croque", data, known);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.row.diet_tags).toContain("vegetarien");
    expect(checked.row.protein).toBe("veg");
    expect(croque.diet_tags).not.toContain("vegetarien");
  });

  it("refuse un ingrédient inconnu, un placeholder orphelin et un champ id dans le JSON", () => {
    const unknown = checkCatalogRecipe("simple", "croque", { ...croque.data, ing: { licorne: 2 } }, known);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.issues).toContain("ingrédient inconnu du catalogue : licorne");

    const orphan = checkCatalogRecipe(
      "simple",
      "croque",
      { ...croque.data, steps: ["Ajoute {jambon}."], ing: { oeufs: 4 } },
      known,
    );
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) expect(orphan.issues).toContain("placeholder orphelin {jambon}");

    expect(checkCatalogRecipe("simple", "croque", { ...croque.data, id: "x" }, known).ok).toBe(false);
    expect(checkCatalogRecipe("simple", "Croque !", croque.data, known).ok).toBe(false);
  });

  it("refuse un champ inconnu (schéma strict) et une protéine absente des ingrédients", () => {
    const extra = checkCatalogRecipe("simple", "croque", { ...croque.data, bonus: true }, known);
    expect(extra.ok).toBe(false);
    const main = rows.recipes.find((r) => r.kind === "main" && r.protein === "veg")!;
    const wrong = checkCatalogRecipe("main", main.id, { ...main.data, p: "poisson" }, known);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.issues).toContain("protéine « poisson » absente des ingrédients");
  });

  it("propose un squelette par type, incomplet tant qu'il n'a pas d'ingrédients", () => {
    for (const kind of EDITABLE_KINDS) {
      const checked = checkCatalogRecipe(kind, "essai", recipeTemplate(kind, "Essai"), known);
      expect(checked.ok, kind).toBe(false);
      if (!checked.ok) expect(checked.issues, kind).toContain("ing : au moins un ingrédient");
    }
  });

  it("dérive un identifiant lisible du nom", () => {
    expect(suggestRecipeId("Gratin de pâtes au jambon", "main")).toBe("gratin_pates_jambon");
    expect(suggestRecipeId("Cake à la banane", "cake")).toBe("c_cake_banane");
    expect(suggestRecipeId("!!", "soup")).toBe("recette");
  });
});
