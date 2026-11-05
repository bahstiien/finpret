import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { landingV2 } from "@/i18n/landing";
import { getRecipe, RECIPES, slugOf } from "./catalog";
import { recipePhoto } from "./images";

describe("photos des recettes", () => {
  it("illustrent toutes les recettes du catalogue, avec un fichier présent dans public/", () => {
    const missing = RECIPES.filter((r) => !r.photo || !existsSync(path.join("public", r.photo.src)));
    expect(missing.map((r) => r.id)).toEqual([]);
  });

  it("se retrouvent par identifiant comme par slug, avec une couleur de fond", () => {
    const a = recipePhoto("poulet_citron", "Poulet");
    expect(a).toEqual(recipePhoto("poulet-citron", "Poulet"));
    expect(a?.bg).toMatch(/^#[0-9a-f]{6}$/);
    expect(recipePhoto("inconnue", "x")).toBeNull();
  });

  it("couvrent le top 5 de l'accueil", () => {
    for (const id of landingV2.top.ids) expect(getRecipe(slugOf(id))?.photo, id).toBeTruthy();
  });
});
