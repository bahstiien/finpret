import { RECIPES } from "./catalog";
import { INDEXABLE_HUBS } from "./hubs";
import { INDEXABLE_MENUS } from "./menus";

/** Chemins indexables de la couche SEO (index, recettes, menus, hubs) : seuls ceux-ci entrent dans le sitemap. */
export const SEO_INDEX_PATHS = ["/recettes", "/menus", "/batch-cooking"] as const;

export function seoPaths(): { path: string; priority: number }[] {
  return [
    ...SEO_INDEX_PATHS.map((path) => ({ path, priority: 0.8 })),
    ...INDEXABLE_HUBS.map((h) => ({ path: `/batch-cooking/${h.slug}`, priority: 0.8 })),
    ...INDEXABLE_MENUS.map((m) => ({ path: `/menus/${m.slug}`, priority: 0.7 })),
    ...RECIPES.map((r) => ({ path: `/recettes/${r.slug}`, priority: 0.6 })),
  ];
}
