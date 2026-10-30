import { BRAND, SITE_URL } from "./config";
import { KIND_CATEGORY, type RecipeView } from "./catalog";
import type { Faq } from "./menus";

/** Données structurées schema.org. Chaque fonction renvoie un objet JSON-LD complet (avec @context). */

const CONTEXT = "https://schema.org";
export const abs = (path: string) => `${SITE_URL}${path}`;

/** Durée ISO 8601 : 95 → « PT1H35M ». */
export function isoDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `PT${h ? `${h}H` : ""}${mm || !h ? `${mm}M` : ""}`;
}

const publisher = { "@type": "Organization", name: BRAND, url: SITE_URL };

export function recipeJsonLd(r: RecipeView, imageUrl: string, description: string, lastmod: string) {
  const n = r.nutrition;
  return {
    "@context": CONTEXT,
    "@type": "Recipe",
    name: r.name,
    image: [imageUrl],
    description,
    author: publisher,
    datePublished: lastmod,
    dateModified: lastmod,
    ...(r.prepMin !== null && { prepTime: isoDuration(r.prepMin) }),
    ...(r.cookMin !== null && { cookTime: isoDuration(r.cookMin) }),
    ...(r.totalMin !== null && { totalTime: isoDuration(r.totalMin) }),
    recipeYield: r.yieldText,
    recipeCategory: KIND_CATEGORY[r.kind],
    recipeCuisine: r.country ?? "Française",
    ...(r.vegetarian && { suitableForDiet: "https://schema.org/VegetarianDiet" }),
    keywords: [r.short, r.batch ? "batch cooking" : "recette", r.freezable ? "congélation" : null].filter(Boolean).join(", "),
    recipeIngredient: r.ingredients.map((i) => `${i.qty} ${i.label}`.trim()),
    recipeInstructions: r.steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
    ...(n && {
      nutrition: {
        "@type": "NutritionInformation",
        servingSize: "1 portion adulte",
        calories: `${n.kcal} kcal`,
        proteinContent: `${n.protein} g`,
        carbohydrateContent: `${n.carbs} g`,
        fatContent: `${n.fat} g`,
      },
    }),
  };
}

export function itemListJsonLd(name: string, items: { name: string; path: string }[]) {
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: abs(it.path) })),
  };
}

export function faqJsonLd(faq: readonly Faq[]) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: readonly Crumb[]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.path) })),
  };
}
