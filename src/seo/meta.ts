import type { Metadata } from "next";
import { BRAND } from "./config";
import { displayName, KIND_LABEL, type RecipeView } from "./catalog";
import type { HubView } from "./hubs";
import type { MenuView } from "./menus";

/** Gabarits de title (< 60 caractères) et de meta description (< 155), spécifiques à chaque page. */

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/** Coupe à la limite de mot et ajoute « … » si besoin ; le résultat ne dépasse jamais `max`. */
export function clamp(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[ ,;:.\-–]+$/, "")}…`;
}

/** Ajoute « | Fin Prêt » seulement si le titre reste sous la limite. */
export function fitTitle(base: string): string {
  const withBrand = `${base} | ${BRAND}`;
  return withBrand.length <= TITLE_MAX ? withBrand : clamp(base, TITLE_MAX);
}

export const recipeTitle = (r: RecipeView) => fitTitle(r.batch ? `${displayName(r)}, recette batch cooking` : `${displayName(r)}, la recette`);

export function recipeDescription(r: RecipeView): string {
  const bits: string[] = [];
  if (r.totalMin) bits.push(`${r.totalMin} min`);
  bits.push(r.yieldText);
  if (r.fridgeDays) bits.push(`${r.fridgeDays} j au frigo`);
  if (r.freezable) bits.push("se congèle");
  const lead = r.description ? `${r.description.replace(/\.$/, "")}. ` : `${KIND_LABEL[r.kind]}. `;
  return clamp(`${lead}${bits.join(", ")}. Ingrédients, étapes et astuces.`, DESCRIPTION_MAX);
}

export const menuTitle = (m: MenuView) => fitTitle(m.h1);

export function menuDescription(m: MenuView): string {
  const names = m.recipes.map((r) => r.short).join(", ");
  const time = m.sessionMin ? ` Session de ${m.sessionMin} min.` : "";
  return clamp(`${m.recipes.length} dîners, liste de courses et planning.${time} ${names}.`, DESCRIPTION_MAX);
}

export const hubTitle = (h: HubView) => fitTitle(h.h1);

export function hubDescription(h: HubView): string {
  return clamp(
    `${h.label} : ${h.recipeCount} recettes, ${h.menus.length} menus de la semaine, conseils et réponses aux questions fréquentes.`,
    DESCRIPTION_MAX,
  );
}

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  indexable: boolean;
  /** Image de partage : chemin de la route `/og/...`. */
  image: string;
  imageAlt: string;
  type?: "article" | "website";
}): Metadata {
  const images = [{ url: opts.image, width: 1200, height: 630, alt: opts.imageAlt }];
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical: opts.path },
    robots: opts.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.path,
      siteName: BRAND,
      locale: "fr_FR",
      type: opts.type ?? "website",
      images,
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images },
  };
}
