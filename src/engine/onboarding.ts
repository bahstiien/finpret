import type { Main, Protein } from "./catalog/schema";
import { economyBonus } from "./cost";
import { dietAllows } from "./env";
import { DEFAULT_MENU_SETTINGS, type Diet, type Library, type MenuSettings } from "./types";

/**
 * Envies de l'onboarding : l'alimentation et les objectifs choisis se traduisent en réglages ordinaires du moteur
 * (plafonds de protéines, minimum végétarien, protéines minimales, objectif économique), modifiables ensuite.
 */

export const GOALS = ["sportif", "economique"] as const;
export type Goal = (typeof GOALS)[number];

/**
 * Protéines minimales par repas (g par portion adulte) de l'objectif « sportif » : le tiers le plus protéiné du
 * catalogue, ou le plus protéiné des plats sans viande (seuil plus bas, sinon il ne reste pas de quoi composer).
 */
export function sportifMinProtein(diet: Diet): number {
  return diet === "vegetarien" || diet === "pescetarien" ? 25 : 35;
}

export type DietPreset = { proteinCaps: MenuSettings["proteinCaps"]; minVeg: number };

/**
 * Équilibre des protéines de la semaine selon l'alimentation. « Équilibré » (omnivore), végétarien et pescétarien
 * gardent les plafonds du prototype (le filtre du régime fait le reste) ; flexitarien et carnivore les déplacent.
 */
export function dietPreset(diet: Diet): DietPreset {
  switch (diet) {
    case "flexitarien":
      return { proteinCaps: { volaille: 1, boeuf: 1, porc: 0, poisson: 1, veg: 4 }, minVeg: 2 };
    case "carnivore":
      return { proteinCaps: { volaille: 2, boeuf: 2, porc: 2, poisson: 1, veg: 1 }, minVeg: 0 };
    default:
      return { proteinCaps: { ...DEFAULT_MENU_SETTINGS.proteinCaps }, minVeg: 0 };
  }
}

/** Protéines des 3 plats d'aperçu, dans l'ordre, pour chaque alimentation. */
const PREVIEW_PROTEINS: Record<Diet, Protein[]> = {
  omnivore: ["volaille", "poisson", "veg"],
  flexitarien: ["veg", "volaille", "veg"],
  vegetarien: ["veg", "veg", "veg"],
  pescetarien: ["poisson", "veg", "poisson"],
  carnivore: ["boeuf", "porc", "volaille"],
};

/** Ordre stable et mélangé (sans hasard) : l'aperçu ne change pas d'un affichage à l'autre. */
const rank = (id: string) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Trois plats du catalogue qui donnent un avant-goût de la semaine pour une alimentation et des objectifs :
 * « sportif » ne garde que les plats riches en protéines, « économique » le tiers le moins cher.
 * `keep` écarte les plats sans photo, par exemple.
 */
export function previewDishes(
  lib: Library,
  diet: Diet,
  goals: readonly Goal[],
  keep: (r: Main) => boolean = () => true,
): Main[] {
  let pool = lib.mains.filter((r) => keep(r) && dietAllows({ diet, allergens: [], refused: [] }, r));
  if (goals.includes("sportif")) {
    const rich = pool.filter((r) => (r.m[1] ?? 0) >= sportifMinProtein(diet));
    if (rich.length >= 3) pool = rich;
  }
  if (goals.includes("economique")) {
    const cheap = Object.keys(economyBonus(lib, pool));
    const third = new Set(cheap.slice(0, Math.max(3, Math.ceil(pool.length / 3))));
    if (third.size >= 3) pool = pool.filter((r) => third.has(r.id));
  }
  pool = [...pool].sort((a, b) => rank(a.id) - rank(b.id));
  const chosen: Main[] = [];
  for (const p of PREVIEW_PROTEINS[diet]) {
    const r = pool.find((x) => x.p === p && !chosen.includes(x)) ?? pool.find((x) => !chosen.includes(x));
    if (r) chosen.push(r);
  }
  return chosen;
}

/** Clé d'un aperçu : alimentation et objectifs, dans l'ordre de GOALS (`omnivore`, `carnivore:sportif+economique`). */
export const previewKey = (diet: Diet, goals: readonly Goal[]) => {
  const g = GOALS.filter((x) => goals.includes(x));
  return g.length ? `${diet}:${g.join("+")}` : diet;
};
