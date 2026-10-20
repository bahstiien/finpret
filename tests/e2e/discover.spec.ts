import { expect, test } from "@playwright/test";
import { FEATURES } from "../../src/lib/features";
import { signInFromLoginPage, supabaseConfigured, uniqueEmail } from "./helpers/auth";

// §6 « Exclusion d'un allergène » et §8.2 Découvrir.
test.skip(!supabaseConfigured, "Supabase n'est pas configuré (voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

test("un allergène coché masque ses recettes dans Découvrir, sauf avec « Afficher tout »", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("allergene"));
  await page.getByLabel("Nom du foyer").fill("Arachides");
  const names = page.getByLabel(/^Prénom/);
  await names.first().fill("Camille");
  await names.nth(1).fill("Julien");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Arachides", exact: true }).click();
  for (let i = 0; i < (FEATURES.onboardingHabits ? 3 : 2); i++)
    await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Préparer ma semaine" }).click();
  await expect(page.getByRole("heading", { name: "Ta semaine est prête !" })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/app/discover");
  const search = page.getByRole("searchbox");
  await search.fill("cacahu");
  await expect(page.getByTestId("recipe-pad_thai")).toHaveCount(0);
  await expect(page.getByTestId("recipe-bowl")).toHaveCount(0);

  await page.getByRole("button", { name: "Afficher tout" }).click();
  await expect(page.getByTestId("recipe-pad_thai")).toBeVisible();
  await expect(page.getByTestId("recipe-pad_thai").getByTestId("excluded")).toContainText("Arachides");
  await expect(
    page.getByTestId("recipe-pad_thai").getByRole("button", { name: "Mettre au menu" }),
  ).toHaveCount(0);

  // Mettre une recette autorisée au menu du samedi midi.
  await search.fill("");
  await page.getByRole("button", { name: "Afficher tout" }).click();
  const first = page.getByTestId("discover-list").getByRole("listitem").first();
  await first.getByRole("button", { name: "Mettre au menu" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio").first().check();
  await sheet.getByRole("button", { name: "Mettre au menu" }).click();
  await expect(page.getByTestId("toast")).toContainText("prévu samedi midi");
});
