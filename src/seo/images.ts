/**
 * Photos des recettes. Le seed n'en contient aucune : tant qu'une recette n'a pas d'entrée ici, la page n'affiche pas
 * de photo et le JSON-LD `Recipe` utilise l'image de partage générée (opengraph-image).
 * Ajouter une photo : `public/recettes/<slug>.webp`, puis une ligne `"<slug>": { src, width, height, alt }`.
 */
export type RecipePhoto = { src: string; width: number; height: number; alt: string };

export const RECIPE_PHOTOS: Readonly<Record<string, RecipePhoto>> = {};
