import photos from "./photos.json";

/**
 * Photos des recettes : `public/recettes/<slug>.webp` (1200 × 900, plat sur fond uni), et dans `photos.json` la couleur
 * de ce fond pour chaque slug illustré. Les deux sont produits par `node scripts/recipe-photos.mjs <dossier de PNG>`.
 * Sans photo, la page n'en affiche pas et le JSON-LD `Recipe` utilise l'image de partage générée (opengraph-image).
 */
export type RecipePhoto = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Couleur du fond uni du visuel. */
  bg: string;
};

const BACKGROUNDS: Readonly<Record<string, string>> = photos;

export const PHOTO_WIDTH = 1200;
export const PHOTO_HEIGHT = 900;

const slugOf = (idOrSlug: string) =>
  idOrSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Photo d'une recette du seed, par slug ou par identifiant (`poulet_citron` et `poulet-citron` donnent la même). */
export function recipePhoto(idOrSlug: string, name: string): RecipePhoto | null {
  const slug = slugOf(idOrSlug);
  const bg = BACKGROUNDS[slug];
  if (!bg) return null;
  return { src: `/recettes/${slug}.webp`, width: PHOTO_WIDTH, height: PHOTO_HEIGHT, alt: name, bg };
}
