import { describe, expect, it } from "vitest";
import { RECIPES } from "./catalog";
import { COMBINATIONS, MIN_RECIPES_PER_MENU, menuSlug } from "./config";
import { HUBS } from "./hubs";
import { breadcrumbJsonLd, faqJsonLd, isoDuration, itemListJsonLd, recipeJsonLd } from "./jsonld";
import { MENUS } from "./menus";
import { clamp, DESCRIPTION_MAX, hubDescription, hubTitle, menuDescription, menuTitle, recipeDescription, recipeTitle, TITLE_MAX } from "./meta";

describe("catalogue public", () => {
  it("a des slugs uniques", () => {
    expect(new Set(RECIPES.map((r) => r.slug)).size).toBe(RECIPES.length);
  });
  it("n'expose aucun placeholder non résolu", () => {
    for (const r of RECIPES) for (const s of r.steps) expect(s, r.slug).not.toMatch(/\{\w+\}/);
  });
  it("donne des ingrédients et des étapes à chaque recette", () => {
    for (const r of RECIPES) {
      expect(r.ingredients.length, r.slug).toBeGreaterThan(0);
      expect(r.steps.length, r.slug).toBeGreaterThan(0);
    }
  });
});

describe("menus", () => {
  it("couvre toutes les combinaisons avec des slugs uniques", () => {
    expect(MENUS).toHaveLength(COMBINATIONS.length);
    expect(new Set(MENUS.map((m) => m.slug)).size).toBe(MENUS.length);
    expect(menuSlug({ persons: 4, constraint: "vegetarien", format: "batch" })).toBe("semaine-4-personnes-vegetarien-batch-cooking");
  });
  it("respecte les contraintes et le seuil de recettes distinctes", () => {
    for (const m of MENUS) {
      expect(new Set(m.recipes.map((r) => r.id)).size, m.slug).toBe(m.recipes.length);
      expect(m.indexable, m.slug).toBe(m.recipes.length >= MIN_RECIPES_PER_MENU);
      if (m.combo.constraint === "vegetarien") expect(m.recipes.every((r) => r.vegetarian), m.slug).toBe(true);
      if (m.combo.format === "batch") expect(m.plan, m.slug).toHaveLength(m.recipes.length);
    }
  });
  it("est déterministe", () => {
    const a = MENUS[0]!.recipes.map((r) => r.id);
    expect(MENUS[0]!.recipes.map((r) => r.id)).toEqual(a);
  });
  it("a une introduction propre à chaque menu", () => {
    expect(new Set(MENUS.map((m) => m.intro.join(" "))).size).toBe(MENUS.length);
  });
  it("met la liste de courses à l'échelle du nombre de personnes", () => {
    const two = MENUS.find((m) => m.slug === "semaine-2-personnes-batch-cooking")!;
    expect(two.scale).toBe(0.5);
    expect(two.shopping.length).toBeGreaterThan(0);
  });
});

describe("hubs", () => {
  it("sont indexables avec assez de contenu", () => {
    for (const h of HUBS) {
      expect(h.recipes.length, h.slug).toBeGreaterThanOrEqual(5);
      expect(h.faq.length, h.slug).toBeGreaterThan(0);
    }
  });
});

describe("on-page", () => {
  it("respecte les longueurs de title et de description", () => {
    for (const r of RECIPES) {
      expect(recipeTitle(r).length, r.slug).toBeLessThanOrEqual(TITLE_MAX);
      expect(recipeDescription(r).length, r.slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
    for (const m of MENUS) {
      expect(menuTitle(m).length, m.slug).toBeLessThanOrEqual(TITLE_MAX);
      expect(menuDescription(m).length, m.slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
    for (const h of HUBS) {
      expect(hubTitle(h).length).toBeLessThanOrEqual(TITLE_MAX);
      expect(hubDescription(h).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });
  it("a des titles uniques", () => {
    const titles = [...RECIPES.map(recipeTitle), ...MENUS.map(menuTitle), ...HUBS.map(hubTitle)];
    expect(new Set(titles).size).toBe(titles.length);
  });
  it("clamp coupe proprement", () => {
    expect(clamp("un deux trois quatre cinq", 12).length).toBeLessThanOrEqual(12);
    expect(clamp("court", 12)).toBe("court");
  });
});

describe("JSON-LD", () => {
  it("formate les durées ISO 8601", () => {
    expect(isoDuration(95)).toBe("PT1H35M");
    expect(isoDuration(45)).toBe("PT45M");
    expect(isoDuration(120)).toBe("PT2H");
  });
  it("produit un Recipe complet", () => {
    const r = RECIPES.find((x) => x.kind === "plat" && x.nutrition)!;
    const ld = recipeJsonLd(r, "https://finpret.app/og/recettes/x", "desc", "2026-10-26") as Record<string, unknown>;
    for (const k of ["name", "image", "description", "recipeIngredient", "recipeInstructions", "prepTime", "cookTime", "totalTime", "recipeYield", "recipeCategory", "recipeCuisine", "nutrition"]) {
      expect(ld[k], k).toBeDefined();
    }
    const steps = ld.recipeInstructions as { "@type": string }[];
    expect(steps.every((s) => s["@type"] === "HowToStep")).toBe(true);
  });
  it("produit ItemList, FAQPage et BreadcrumbList", () => {
    expect(itemListJsonLd("x", [{ name: "a", path: "/recettes/a" }]).itemListElement[0]!.url).toBe("https://finpret.app/recettes/a");
    expect(faqJsonLd([{ q: "q", a: "a" }])["@type"]).toBe("FAQPage");
    expect(breadcrumbJsonLd([{ name: "Accueil", path: "/" }]).itemListElement[0]!.position).toBe(1);
  });
});
