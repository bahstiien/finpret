import { INGREDIENT_ALLERGENS } from "./allergens";
import {
  allIngredientKeys,
  breakfastId,
  deriveProtein,
  dietTags,
  isSeasonalIngredient,
  recipeAllergens,
} from "./derive";
import type { Protein, Seed } from "./schema";

/** Lignes des tables du catalogue (§9), construites à partir du seed validé. */

export type AisleRow = { key: string; label: string; position: number };
export type IngredientRow = {
  key: string;
  label: string;
  unit: string;
  aisle: string;
  forms: { n?: [string, string]; showN?: boolean; s?: string };
  half: boolean;
  allergens: string[];
  seasonal: boolean;
};
export type PackRow = { ingredient_key: string; sizes: number[]; label: string; tolerance: number };
export type RecipeKind = "main" | "soup" | "simple" | "cake" | "breakfast";
export type RecipeRow = {
  id: string;
  kind: RecipeKind;
  data: Record<string, unknown>;
  origin: string | null;
  protein: Protein | null;
  months: number[] | null;
  /** null = inconnu : un filtre de régime ou d'allergène doit écarter la recette. */
  diet_tags: string[] | null;
  allergens: string[] | null;
};

export type CatalogRows = {
  aisles: AisleRow[];
  ingredients: IngredientRow[];
  packs: PackRow[];
  recipes: RecipeRow[];
};

/** Rayon des ingrédients de placard (`c: "base"`), absent de aisles.json : non acheté par défaut. */
export const PANTRY_AISLE: AisleRow = { key: "base", label: "Placard", position: 99 };

const DEFAULT_PACK_TOLERANCE = 0.2;

export function buildCatalogRows(seed: Seed): CatalogRows {
  const aisles: AisleRow[] = [
    ...seed.aisles.map(([key, label], i) => ({ key, label, position: i + 1 })),
    PANTRY_AISLE,
  ];

  const ingredients: IngredientRow[] = Object.entries(seed.ingredients).map(([key, g]) => ({
    key,
    label: g.l,
    unit: g.u,
    aisle: g.c,
    forms: { ...(g.n && { n: g.n }), ...(g.showN && { showN: g.showN }), ...(g.s && { s: g.s }) },
    half: g.half ?? false,
    allergens: [...(INGREDIENT_ALLERGENS[key] ?? [])],
    seasonal: isSeasonalIngredient(key, g, seed.notSeasonal),
  }));

  const packs: PackRow[] = Object.entries(seed.packs).map(([key, p]) => ({
    ingredient_key: key,
    sizes: p.s,
    label: p.l,
    tolerance: p.tol ?? DEFAULT_PACK_TOLERANCE,
  }));

  const recipe = (
    kind: RecipeKind,
    r: {
      id: string;
      o?: string | null;
      months?: number[];
      ing: Record<string, number>;
      sv?: { ing: Record<string, number> }[];
    },
    protein: Protein | null,
  ): RecipeRow => {
    const keys = allIngredientKeys(r);
    const { id, ...data } = r;
    return {
      id,
      kind,
      data,
      origin: r.o ?? null,
      protein,
      months: r.months ?? null,
      diet_tags: dietTags(keys),
      allergens: recipeAllergens(keys),
    };
  };

  const recipes: RecipeRow[] = [
    ...seed.mains.map((r) => recipe("main", r, r.p)),
    ...seed.soups.map((r) => recipe("soup", r, r.p)),
    ...seed.simples.map((r) => recipe("simple", r, deriveProtein(Object.keys(r.ing)))),
    ...seed.cakes.map((r) => recipe("cake", r, null)),
    ...seed.breakfasts.map((b): RecipeRow => ({
      id: breakfastId(b.n),
      kind: "breakfast",
      data: { ...b },
      origin: null,
      protein: null,
      months: null,
      // Petits-déjeuners décrits en texte libre, sans liste d'ingrédients : régime et allergènes inconnus.
      // TODO(spec) : les renseigner, ou structurer leurs ingrédients, pour pouvoir les proposer avec un filtre actif.
      diet_tags: null,
      allergens: null,
    })),
  ];

  return { aisles, ingredients, packs, recipes };
}
