import type { Cake, Main, Protein, Simple, Soup } from "./catalog/schema";
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
  recipe: { ing: Record<string, number>; sv?: { ing: Record<string, number> }[]; p?: Protein },
) {
  const keys = allIngredientKeys(recipe);
  if (rules.refused.some((k) => keys.includes(k))) return false;
  if (rules.allergens.length) {
    const allergens = recipeAllergens(keys, false);
    if (rules.allergens.some((a) => (allergens as string[]).includes(a))) return false;
  }
  if (rules.diet === "vegetarien" || rules.diet === "pescetarien") {
    if (!dietTags(keys, recipe.p).includes(rules.diet)) return false;
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
  /** Types de goûter retenus (réglage « Goûter de la semaine ») ; tous si absent. */
  cakeTypes?: readonly string[];
}): Env {
  const allow = <R extends { ing: Record<string, number> }>(r: R) =>
    !options.diet || dietAllows(options.diet, r);
  const minProtein = options.diet?.minProtein ?? 0;
  // Une recette importée aux macros inconnues (`mu`) n'est pas écartée par le seuil de protéines.
  const meal = <R extends { ing: Record<string, number>; m: readonly number[]; mu?: true }>(r: R) =>
    allow(r) && (r.mu === true || (r.m[1] ?? 0) >= minProtein);
  const filtered = {
    mains: options.lib.mains.filter(meal),
    soups: options.lib.soups.filter(meal),
    simples: options.lib.simples.filter(meal),
    cakes: options.lib.cakes.filter(
      (c) => allow(c) && (!options.cakeTypes || options.cakeTypes.includes(c.t)),
    ),
  };
  // Recettes supprimées par le foyer : retirées du tirage, mais encore lisibles par les semaines qui les contiennent.
  const retired = new Set(options.lib.retired ?? []);
  const active = <R extends { id: string }>(list: R[]) =>
    retired.size ? list.filter((r) => !retired.has(r.id)) : list;
  const lib: Library = {
    ...options.lib,
    mains: active(filtered.mains),
    soups: active(filtered.soups),
    simples: active(filtered.simples),
    cakes: active(filtered.cakes),
  };
  return {
    lib,
    pantry: options.pantry ?? {},
    ratings: options.ratings ?? {},
    random: options.random,
    ignoreDislike: false,
    diet: options.diet ?? null,
    bonus: options.bonus ?? {},
    mainById: new Map(filtered.mains.map((r) => [r.id, r])),
    soupById: new Map(filtered.soups.map((r) => [r.id, r])),
    simpleById: new Map(filtered.simples.map((r) => [r.id, r])),
    cakeById: new Map(filtered.cakes.map((r) => [r.id, r])),
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
export const isWorld = (r: { o?: string | null } | null | undefined) => !!r && !!r.o && r.o !== "fr";

/** Recette d'un repas de la réserve (plat de batch ou soupe). */
export const bankRecipe = (env: Env, id: string) => env.mainById.get(id) ?? env.soupById.get(id);
/** N'importe quelle recette de repas. */
export const anyRecipe = (env: Env, id: string) =>
  env.mainById.get(id) ?? env.soupById.get(id) ?? env.simpleById.get(id) ?? null;
