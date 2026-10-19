import type { Cake, Main, Simple, Soup } from "./catalog/schema";
import { allIngredientKeys, dietTags, recipeAllergens } from "./catalog/derive";
import type { DietRules, Library, Pantry, Ratings } from "./types";

/**
 * Environnement d'un calcul du moteur : catalogue filtré, garde-manger, avis et tirage aléatoire.
 * Remplace l'état global du prototype (LIB, pantry, ratings, IGNORE_DISLIKE…).
 */
export type Env = {
  lib: Library;
  pantry: Pantry;
  ratings: Ratings;
  random: () => number;
  /** Dernier recours de la génération : les recettes refusées (👎) redeviennent possibles. */
  ignoreDislike: boolean;
  /** Régime du foyer (le catalogue est déjà filtré ; sert aussi aux plafonds de protéines). */
  diet: DietRules | null;
  /** Bonus de tirage des recettes importées par le foyer (+0,3, §8.8). */
  bonus: Record<string, number>;
  mainById: Map<string, Main>;
  soupById: Map<string, Soup>;
  simpleById: Map<string, Simple>;
  cakeById: Map<string, Cake>;
};

/** Le régime, les allergènes et les refus filtrent le catalogue avant tout le reste (§7.3, point 7). */
export function dietAllows(
  rules: DietRules,
  recipe: { ing: Record<string, number>; sv?: { ing: Record<string, number> }[] },
) {
  const keys = allIngredientKeys(recipe);
  if (rules.refused.some((k) => keys.includes(k))) return false;
  if (rules.allergens.length) {
    const allergens = recipeAllergens(keys);
    if (rules.allergens.some((a) => (allergens as string[]).includes(a))) return false;
  }
  if (rules.diet === "vegetarien" || rules.diet === "pescetarien") {
    if (!dietTags(keys).includes(rules.diet)) return false;
  }
  return true;
}

export function createEnv(options: {
  lib: Library;
  pantry?: Pantry;
  ratings?: Ratings;
  random: () => number;
  diet?: DietRules;
  bonus?: Record<string, number>;
}): Env {
  const allow = <R extends { ing: Record<string, number> }>(r: R) =>
    !options.diet || dietAllows(options.diet, r);
  const lib: Library = {
    ...options.lib,
    mains: options.lib.mains.filter(allow),
    soups: options.lib.soups.filter(allow),
    simples: options.lib.simples.filter(allow),
    cakes: options.lib.cakes.filter(allow),
  };
  return {
    lib,
    pantry: options.pantry ?? {},
    ratings: options.ratings ?? {},
    random: options.random,
    ignoreDislike: false,
    diet: options.diet ?? null,
    bonus: options.bonus ?? {},
    mainById: new Map(lib.mains.map((r) => [r.id, r])),
    soupById: new Map(lib.soups.map((r) => [r.id, r])),
    simpleById: new Map(lib.simples.map((r) => [r.id, r])),
    cakeById: new Map(lib.cakes.map((r) => [r.id, r])),
  };
}

/**
 * Plafonds de protéines effectifs : pour un foyer végétarien ou pescétarien, le plafond « végétarien »
 * ne limite plus rien (sinon aucune semaine de 4 plats ne serait possible).
 */
export function effectiveSettings<S extends { proteinCaps: Record<string, number> }>(env: Env, s: S): S {
  if (env.diet?.diet !== "vegetarien" && env.diet?.diet !== "pescetarien") return s;
  return { ...s, proteinCaps: { ...s.proteinCaps, veg: Number.POSITIVE_INFINITY } };
}

export const allowed = (env: Env, r: { id: string }) => env.ignoreDislike || env.ratings[r.id] !== -1;
export const isFav = (env: Env, r: { id: string } | undefined | null) => !!r && env.ratings[r.id] === 1;
/** Recette du monde : origine autre que la France. */
export const isWorld = (r: { o?: string } | null | undefined) => !!r && !!r.o && r.o !== "fr";

/** Recette d'un repas de la réserve (plat de batch ou soupe). */
export const bankRecipe = (env: Env, id: string) => env.mainById.get(id) ?? env.soupById.get(id);
/** N'importe quelle recette de repas. */
export const anyRecipe = (env: Env, id: string) =>
  env.mainById.get(id) ?? env.soupById.get(id) ?? env.simpleById.get(id) ?? null;
