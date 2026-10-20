import { ALLERGENS, type Allergen, INGREDIENT_ALLERGENS } from "./allergens";
import type { Ingredient, Protein } from "./schema";

/** Ingrédients de chair animale et protéine correspondante (l'agneau compte comme viande rouge, comme dans le prototype). */
export const ANIMAL_PROTEIN: Record<string, Exclude<Protein, "veg">> = {
  poulet: "volaille",
  dinde: "volaille",
  cuisse: "volaille",
  boeuf: "boeuf",
  paleron: "boeuf",
  steak: "boeuf",
  agneau: "boeuf",
  jambon: "porc",
  lardons: "porc",
  saucisse: "porc",
  echine: "porc",
  saumon: "poisson",
  cabillaud: "poisson",
  thon: "poisson",
  saumonfume: "poisson",
};

/** Ordre de priorité quand une recette sans champ `p` mélange plusieurs protéines. */
const PROTEIN_PRIORITY: Exclude<Protein, "veg">[] = ["boeuf", "porc", "volaille", "poisson"];

export const DIET_TAGS = ["vegetarien", "pescetarien"] as const;
export type DietTag = (typeof DIET_TAGS)[number];

type WithIngredients = { ing: Record<string, number>; sv?: { ing: Record<string, number> }[] };

/** Toutes les clés d'ingrédients d'une recette, variantes de saison comprises. */
export function allIngredientKeys(recipe: WithIngredients): string[] {
  const keys = new Set(Object.keys(recipe.ing));
  for (const variant of recipe.sv ?? []) for (const key of Object.keys(variant.ing)) keys.add(key);
  return [...keys];
}

/**
 * Allergènes d'une recette : union de ceux de ses ingrédients, dans l'ordre réglementaire.
 * `strict` (catalogue) : un ingrédient absent de la table est une erreur. Sinon (ingrédients créés par un foyer
 * lors d'un import, allergènes inconnus) il est ignoré. TODO(spec) : allergènes des ingrédients du foyer.
 */
export function recipeAllergens(keys: readonly string[], strict = true): Allergen[] {
  const found = new Set<Allergen>();
  for (const key of keys) {
    const allergens = INGREDIENT_ALLERGENS[key];
    if (!allergens) {
      if (!strict) continue;
      throw new Error(`Ingrédient sans entrée dans la table des allergènes : ${key}`);
    }
    for (const allergen of allergens) found.add(allergen);
  }
  return (Object.keys(ALLERGENS) as Allergen[]).filter((a) => found.has(a));
}

/** Régimes compatibles : végétarien sans chair animale, pescétarien sans viande (poisson admis). */
export function dietTags(keys: readonly string[], declared?: Protein): DietTag[] {
  const proteins = new Set(keys.map((k) => ANIMAL_PROTEIN[k]).filter(Boolean));
  // Protéine déclarée à l'import (ingrédients du foyer inconnus de cette table).
  if (declared && declared !== "veg") proteins.add(declared);
  if (proteins.size === 0) return ["vegetarien", "pescetarien"];
  if (proteins.size === 1 && proteins.has("poisson")) return ["pescetarien"];
  return [];
}

/** Protéine principale déduite des ingrédients (soirs simples, recettes importées). */
export function deriveProtein(keys: readonly string[]): Protein {
  const proteins = new Set(keys.map((k) => ANIMAL_PROTEIN[k]).filter(Boolean));
  return PROTEIN_PRIORITY.find((p) => proteins.has(p)) ?? "veg";
}

/** Légume soumis à la saisonnalité (`vegKeys` du prototype). */
export function isSeasonalIngredient(key: string, ingredient: Ingredient, notSeasonal: readonly string[]) {
  return ingredient.c === "legumes" && !notSeasonal.includes(key);
}

/** Identifiant stable d'un petit-déjeuner (le seed n'en fournit pas) : « b_ » + nom normalisé. */
export function breakfastId(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `b_${slug}`;
}

type TextRecipe = {
  ing: Record<string, number>;
  d?: string;
  prep?: string[];
  steps?: string[];
  blocks?: { a: string[] }[];
  box?: string;
  jj?: string;
  kid?: string;
  sv?: { l: string; ing: Record<string, number>; prep: string[] }[];
};

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Placeholders `{clé}` qui ne correspondent à aucun ingrédient de la recette : `fill` du
 * prototype les afficherait tels quels. Chaque variante de saison est vérifiée avec ses
 * ingrédients fusionnés, comme le fait `resolve`.
 */
export function orphanPlaceholders(recipe: TextRecipe): string[] {
  const baseTexts = [
    recipe.d,
    ...(recipe.prep ?? []),
    ...(recipe.steps ?? []),
    ...(recipe.blocks ?? []).flatMap((b) => b.a),
    recipe.box,
    recipe.jj,
    recipe.kid,
  ].filter((t): t is string => typeof t === "string");

  const variants = recipe.sv?.length
    ? recipe.sv.map((v) => ({
        label: v.l,
        ing: { ...recipe.ing, ...v.ing },
        texts: [...baseTexts, ...v.prep],
      }))
    : [{ label: undefined, ing: recipe.ing, texts: baseTexts }];

  const orphans = new Set<string>();
  for (const { label, ing, texts } of variants) {
    for (const text of texts) {
      for (const [, key] of text.matchAll(PLACEHOLDER)) {
        if (key && ing[key] === undefined) orphans.add(label ? `${key} (variante « ${label} »)` : key);
      }
    }
  }
  return [...orphans];
}
