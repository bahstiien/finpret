import { expect, test } from "@playwright/test";
import { dbConfigured, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";
import { FEATURES } from "../../src/lib/features";

// §8.8 Import de recette par lien. Les pages sont des fixtures servies sous https://recettes.test/<nom>.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(
  !FEATURES.recipeImport,
  "Import de recettes REPORTÉ (SPEC_JANVIER) : drapeau FEATURES.recipeImport",
);
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

test("import d'une recette Marmiton, validation, puis affichage dans Découvrir", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("import"));
  await completeOnboarding(page, "Importeurs");

  await page.goto("/app/discover");
  await page.getByRole("link", { name: "Importer une recette" }).click();
  await expect(page).toHaveURL(/\/app\/discover\/import$/);

  // URL interdite (SSRF).
  const url = page.getByLabel("Lien de la recette");
  await url.fill("http://192.168.1.10/recette");
  await page.getByRole("button", { name: "Lire la recette" }).click();
  await expect(page.getByText("Ce lien n'est pas accessible.")).toBeVisible();

  // Recette avec JSON-LD : portions ramenées à 4, 90 % des ingrédients reconnus.
  await url.fill("https://recettes.test/marmiton");
  await page.getByRole("button", { name: "Lire la recette" }).click();
  await expect(page.getByRole("heading", { name: "Vérifie la recette" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Nom")).toHaveValue("Poulet basquaise facile");
  await expect(page.getByTestId("import-quality")).toHaveText("9 ingrédients reconnus sur 10");
  await expect(page.getByText("Recette pour 6 : quantités ramenées à 4 portions.")).toBeVisible();
  await expect(page.locator("[data-uncertain]")).toHaveCount(1);
  // Le texte d'origine des étapes n'est jamais repris.
  await expect(page.getByText("Texte de démonstration")).toHaveCount(0);

  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page
    .getByRole("textbox", { name: "Étape 1", exact: true })
    .fill("Fais dorer le poulet, ajoute les légumes et laisse mijoter 45 min.");
  await page.getByRole("button", { name: "Ajouter à mes recettes" }).click();

  await expect(page).toHaveURL(/\/app\/discover\?open=imp_/, { timeout: 20_000 });
  const card = page.locator('[data-testid^="recipe-imp_"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("Mes recettes");
  await expect(card.getByTestId("recipe-source")).toHaveText("Source : Marmiton");
  await page.getByRole("button", { name: "Mes recettes" }).click();
  await expect(page.getByText("1 recette", { exact: true })).toBeVisible();

  // Page sans recette, reçue par la cible de partage : message clair et saisie à la main proposée.
  await page.goto("/app/discover/import?text=Regarde%20https%3A%2F%2Frecettes.test%2Fno-recipe");
  await expect(page.getByText(/On n'a pas trouvé de recette exploitable/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Saisir à la main" })).toBeVisible();
});
