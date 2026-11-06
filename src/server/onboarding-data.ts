import "server-only";
import type { Main } from "@/engine/catalog/schema";
import { GOALS, type Goal, previewDishes, previewKey } from "@/engine/onboarding";
import type { Diet } from "@/engine/types";
import { DIETS } from "@/lib/settings";
import { recipePhoto, type RecipePhoto } from "@/seo/images";
import { loadLibrary } from "./catalog";

/** Plat montré pendant l'onboarding : nom court et photo du catalogue. */
export type OnboardingDish = { id: string; name: string; photo: RecipePhoto };

/** Toutes les combinaisons d'objectifs (aucun, chacun, tous). */
const GOAL_SETS: Goal[][] = [[], ...GOALS.map((g) => [g]), [...GOALS]];

/** Aucun foyer encore : on ne lit que le catalogue global. */
const NO_HOUSEHOLD = "00000000-0000-0000-0000-000000000000";

export type OnboardingDishes = {
  /** Mosaïque de bienvenue et défilé de la génération (6 plats variés). */
  showcase: OnboardingDish[];
  /** Photo de chaque carte d'alimentation. */
  diets: Record<Diet, OnboardingDish>;
  /** Photo de chaque carte d'objectif. */
  goals: Record<Goal, OnboardingDish>;
  /** Trois plats d'aperçu par alimentation et objectifs (clé : previewKey). */
  previews: Record<string, OnboardingDish[]>;
};

/** Plats du catalogue qui illustrent l'onboarding : de vraies recettes, avec leur photo. */
export async function onboardingDishes(): Promise<OnboardingDishes> {
  const { lib } = await loadLibrary(NO_HOUSEHOLD);
  const dish = (r: Main): OnboardingDish => ({ id: r.id, name: r.s, photo: recipePhoto(r.id, r.n)! });
  const hasPhoto = (r: Main) => recipePhoto(r.id, r.n) !== null;

  const previews: Record<string, OnboardingDish[]> = {};
  for (const diet of DIETS)
    for (const goals of GOAL_SETS)
      previews[previewKey(diet, goals)] = previewDishes(lib, diet, goals, hasPhoto).map(dish);

  const first = (key: string, i = 0) => previews[key]![i] ?? previews[key]![0]!;
  const diets = Object.fromEntries(DIETS.map((d) => [d, first(d)])) as Record<Diet, OnboardingDish>;
  const goals = Object.fromEntries(GOALS.map((g) => [g, first(previewKey("omnivore", [g]), 1)])) as Record<
    Goal,
    OnboardingDish
  >;

  const showcase: OnboardingDish[] = [];
  for (const key of ["omnivore", "vegetarien", "carnivore", "pescetarien", "flexitarien"])
    for (const d of previews[key]!)
      if (showcase.length < 6 && !showcase.some((x) => x.id === d.id)) showcase.push(d);

  return { showcase, diets, goals, previews };
}
