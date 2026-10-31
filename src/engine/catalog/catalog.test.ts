import { describe, expect, it } from "vitest";
import { ALLERGENS, INGREDIENT_ALLERGENS } from "./allergens";
import { breakfastId, deriveProtein, dietTags, orphanPlaceholders, recipeAllergens } from "./derive";
import { buildCatalogRows } from "./rows";
import { rawSeed } from "./seed-files";
import { validateSeed } from "./validate";

const { seed, issues, warnings } = validateSeed(rawSeed);
const rows = seed ? buildCatalogRows(seed) : null;

describe("validité du seed (§7.6)", () => {
  it("respecte le format de seed/README.md et ses références croisées", () => {
    expect(issues).toEqual([]);
  });

  it("ne tolère que les deux soupes « veg » servies avec des tartines garnies", () => {
    // Soupes végétariennes, tartines au jambon ou au thon le jour du repas : `p` reste « veg »
    // (équilibre des protéines du prototype), mais le régime est déduit de tous les ingrédients.
    expect(warnings).toEqual([
      "veloute_courgette : marqué végétarien mais contient porc",
      "soupe_froide_concombre : marqué végétarien mais contient poisson",
    ]);
    const tags = (id: string) => rows!.recipes.find((r) => r.id === id)!.diet_tags;
    expect(tags("veloute_courgette")).toEqual([]);
    expect(tags("soupe_froide_concombre")).toEqual(["pescetarien"]);
  });

  it("contient les volumes annoncés", () => {
    expect(Object.keys(seed!.ingredients)).toHaveLength(152);
    expect(seed!.mains.length + seed!.soups.length + seed!.simples.length).toBe(372);
    expect(seed!.cakes).toHaveLength(47);
    expect(seed!.breakfasts).toHaveLength(35);
  });

  it("donne une entrée d'allergènes à chaque ingrédient, avec des allergènes réglementaires", () => {
    expect(Object.keys(INGREDIENT_ALLERGENS).sort()).toEqual(Object.keys(seed!.ingredients).sort());
    for (const list of Object.values(INGREDIENT_ALLERGENS)) {
      for (const allergen of list) expect(Object.keys(ALLERGENS)).toContain(allergen);
    }
  });
});

describe("lignes du catalogue", () => {
  it("produit une ligne par recette, avec des identifiants uniques", () => {
    const counts = Object.groupBy(rows!.recipes, (r) => r.kind);
    expect(counts.main).toHaveLength(258);
    expect(counts.soup).toHaveLength(34);
    expect(counts.simple).toHaveLength(80);
    expect(counts.cake).toHaveLength(47);
    expect(counts.breakfast).toHaveLength(35);
    expect(new Set(rows!.recipes.map((r) => r.id)).size).toBe(rows!.recipes.length);
  });

  it("ne garde pas l'identifiant dans les données de la recette", () => {
    for (const r of rows!.recipes) expect(r.data).not.toHaveProperty("id");
  });

  it("ajoute le rayon Placard à la fin, pour les ingrédients de base", () => {
    expect(rows!.aisles.at(-1)).toEqual({ key: "base", label: "Placard", position: 99 });
    expect(rows!.aisles.map((a) => a.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 99]);
  });

  it("marque saisonniers les légumes, sauf ceux de notSeasonal.json", () => {
    const seasonal = (key: string) => rows!.ingredients.find((i) => i.key === key)!.seasonal;
    expect(seasonal("courgette")).toBe(true);
    expect(seasonal("citron")).toBe(false);
    expect(seasonal("poulet")).toBe(false);
  });

  it("applique la tolérance par défaut de 20 % aux contenants", () => {
    expect(rows!.packs.find((p) => p.ingredient_key === "passata")).toMatchObject({
      sizes: [500, 700],
      tolerance: 0.2,
    });
    expect(rows!.packs.find((p) => p.ingredient_key === "mozzarella")!.tolerance).toBe(0.5);
  });

  it("garde les allergènes et régimes inconnus des petits-déjeuners à null", () => {
    for (const r of rows!.recipes.filter((r) => r.kind === "breakfast")) {
      expect(r.allergens).toBeNull();
      expect(r.diet_tags).toBeNull();
    }
  });

  it("donne une protéine à chaque repas et aucune aux goûters", () => {
    for (const r of rows!.recipes) {
      if (["main", "soup", "simple"].includes(r.kind)) expect(r.protein).not.toBeNull();
      else expect(r.protein).toBeNull();
    }
  });
});

describe("déductions", () => {
  it("unit les allergènes des ingrédients dans l'ordre réglementaire", () => {
    expect(recipeAllergens(["pesto", "patescompletes", "oeufs"])).toEqual([
      "gluten",
      "oeufs",
      "lait",
      "fruits_a_coque",
    ]);
    expect(() => recipeAllergens(["inconnu"])).toThrow(/inconnu/);
  });

  it("déduit les régimes compatibles", () => {
    expect(dietTags(["lentillescorail", "laitcoco"])).toEqual(["vegetarien", "pescetarien"]);
    expect(dietTags(["saumon", "riz"])).toEqual(["pescetarien"]);
    expect(dietTags(["poulet", "riz"])).toEqual([]);
    expect(dietTags(["thon", "lardons"])).toEqual([]);
  });

  it("déduit la protéine principale", () => {
    expect(deriveProtein(["oeufs", "feta"])).toBe("veg");
    expect(deriveProtein(["agneau"])).toBe("boeuf");
    expect(deriveProtein(["thon", "jambon"])).toBe("porc");
  });

  it("crée un identifiant stable pour les petits-déjeuners", () => {
    expect(breakfastId("Porridge banane et beurre de cacahuète")).toBe(
      "b_porridge_banane_et_beurre_de_cacahuete",
    );
    expect(breakfastId("Œufs brouillés")).toBe("b_oeufs_brouilles");
  });

  it("repère un placeholder orphelin, y compris dans une variante de saison", () => {
    expect(orphanPlaceholders({ ing: { riz: 100 }, steps: ["Cuis {riz} et {pates}."] })).toEqual(["pates"]);
    const recipe: Parameters<typeof orphanPlaceholders>[0] = {
      ing: { riz: 100 },
      prep: ["Rince {riz}."],
      sv: [
        { l: "été", ing: { courgette: 1 }, prep: ["Coupe {courgette}."] },
        { l: "hiver", ing: { poireau: 1 }, prep: ["Émince {courgette}."] },
      ],
    };
    expect(orphanPlaceholders(recipe)).toEqual(["courgette (variante « hiver »)"]);
  });

  it("signale un seed incohérent", () => {
    const broken = JSON.parse(JSON.stringify(rawSeed));
    broken.mains[0].ing.licorne = 1;
    const { issues: found } = validateSeed(broken);
    expect(found).toContainEqual(expect.stringContaining("ingrédient inconnu licorne"));
  });
});
