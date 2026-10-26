/** Configuration du SEO programmatique : seuils, constantes du site et combinaisons de menus ciblées. */

export const SITE_URL = (process.env.APP_URL ?? "https://finpret.app").replace(/\/$/, "");
export const BRAND = "Fin Prêt";
/** Page d'inscription / connexion vers laquelle pointent tous les CTA. */
export const SIGNUP_PATH = "/login";
export const CTA_LABEL = "Génère ton menu personnalisé gratuitement";

/**
 * Date de dernière mise à jour du contenu du catalogue (seed/*.json et gabarits de ce dossier).
 * À avancer à chaque changement de contenu : elle alimente `lastmod` du sitemap et `dateModified`.
 */
export const CONTENT_LASTMOD = "2026-10-26";

/** Un menu n'est indexable que s'il contient au moins ce nombre de recettes distinctes. */
export const MIN_RECIPES_PER_MENU = 5;
/** Un hub n'est indexable que s'il propose au moins ce nombre de recettes et de menus indexables. */
export const MIN_RECIPES_PER_HUB = 5;
export const MIN_MENUS_PER_HUB = 2;
/** Nombre de repas d'un menu de la semaine (dîners). */
export const MEALS_PER_MENU = 5;

export const PERSONS = [2, 4, 6] as const;
export type Persons = (typeof PERSONS)[number];

export const CONSTRAINTS = ["classique", "budget", "vegetarien", "enfants", "rapide"] as const;
export type Constraint = (typeof CONSTRAINTS)[number];

export const FORMATS = ["batch", "quotidien"] as const;
export type MenuFormat = (typeof FORMATS)[number];

export type Combination = { persons: Persons; constraint: Constraint; format: MenuFormat };

/** Toutes les combinaisons ciblées : nombre de personnes × contrainte × format. Pour en retirer ou en ajouter, voir SEO.md. */
export const COMBINATIONS: readonly Combination[] = PERSONS.flatMap((persons) =>
  CONSTRAINTS.flatMap((constraint) => FORMATS.map((format) => ({ persons, constraint, format }))),
);

export const CONSTRAINT_SLUG: Record<Constraint, string | null> = {
  classique: null,
  budget: "pas-cher",
  vegetarien: "vegetarien",
  enfants: "enfants",
  rapide: "rapide",
};

export function menuSlug({ persons, constraint, format }: Combination): string {
  return ["semaine", `${persons}-personnes`, CONSTRAINT_SLUG[constraint], format === "batch" ? "batch-cooking" : null]
    .filter(Boolean)
    .join("-");
}
