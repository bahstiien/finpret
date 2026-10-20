import { expect, test } from "@playwright/test";
import { signInFromLoginPage, supabaseConfigured, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// Jalon M5 (§8.1, §8.7) : Générer, Changer, Déplacer, Retirer, Convives et Week-end.
test.skip(!supabaseConfigured, "Supabase n'est pas configuré (voir .env.example)");
test.describe.configure({ mode: "parallel" });

test("écran Menu : générer, changer, retirer, déplacer, convives, week-end", async ({ page, isMobile }) => {
  test.skip(isMobile, "parcours joué sur le projet desktop");
  test.setTimeout(120_000);
  const toast = page.getByTestId("toast");
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("menu"));
  await completeOnboarding(page, "Menu");
  await page.getByRole("link", { name: "Voir mon menu" }).click();
  await expect(page.getByTestId("summary-meals")).toHaveText("10");

  // Générer un nouveau menu.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Générer un nouveau menu" }).click();
  await expect(toast).toContainText("Nouveau menu prêt");

  // Changer le premier plat.
  const firstDish = page.getByTestId("dishes").getByRole("listitem").first();
  const before = await firstDish.locator("b").innerText();
  await firstDish.getByRole("button", { name: /^Changer / }).click();
  await expect(toast).toContainText("remplacé par");
  // « Changer » peut réattribuer les plats aux créneaux : le plat remplacé n'est plus dans la semaine.
  await expect(
    page
      .getByTestId("dishes")
      .locator("b")
      .filter({ hasText: before.replace(/^[A-Z]{2}/, "") }),
  ).toHaveCount(0);

  // Retirer puis remettre le dîner du lundi (le programme affiche le lundi avant le début de la semaine).
  await page.getByRole("button", { name: /^lundi \d+/ }).click();
  const mondayDinner = page.getByTestId("meal-1-dinner");
  await mondayDinner.getByRole("button", { name: /^Actions pour/ }).click();
  await page.getByRole("menuitem", { name: "Retirer" }).click();
  await expect(toast).toContainText("Repas retiré");
  await expect(page.getByTestId("summary-meals")).toHaveText("9");
  await mondayDinner.getByRole("button", { name: /^Actions pour/ }).click();
  await page.getByRole("menuitem", { name: "Remettre" }).click();
  await expect(toast).toContainText("Repas remis");
  await expect(page.getByTestId("summary-meals")).toHaveText("10");

  // Déplacer le dîner du lundi vers un créneau autorisé.
  await mondayDinner.getByRole("button", { name: /^Actions pour/ }).click();
  await page.getByRole("menuitem", { name: "Déplacer" }).click();
  const moveSheet = page.getByRole("dialog");
  await expect(moveSheet.getByRole("radio").first()).toBeVisible();
  await moveSheet.getByRole("radio", { disabled: false }).first().check();
  await moveSheet.getByRole("button", { name: "Déplacer ici" }).click();
  await expect(toast).toContainText("Repas échangés");

  // Qui est à table ? Un adulte de plus au déjeuner du lundi.
  await page
    .getByTestId("meal-1-lunch")
    .getByRole("button", { name: /adulte|famille/ })
    .click();
  const guests = page.getByRole("dialog");
  await guests.getByRole("button", { name: "Adultes : plus" }).click();
  await guests.getByRole("button", { name: /^Valider · 3 parts$/ }).click();
  await expect(toast).toContainText("Convives enregistrés");
  await expect(page.getByTestId("meal-1-lunch").getByRole("button", { name: "3 adultes" })).toBeVisible();

  // Week-end : suggestions, puis choix d'une recette à la main pour le samedi soir.
  await page.getByRole("button", { name: "Suggérer des idées" }).click();
  await expect(toast).toContainText("pour le week-end");
  await expect(page.getByTestId("summary-meals")).toHaveText("14");
  await page.getByRole("button", { name: /^samedi soir : .+Touche pour changer/ }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "Toutes" }).click();
  await picker.getByRole("radio").nth(2).check();
  await picker.getByRole("button", { name: /^Mettre .+ samedi soir$/ }).click();
  await expect(toast).toContainText("prévu samedi soir");
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "vérification de mise en page mobile");
  test("l'écran Menu ne déborde pas horizontalement et salue le membre lié au compte", async ({ page }) => {
    test.skip(!supabaseConfigured, "Supabase n'est pas configuré");
    test.setTimeout(90_000);
    await page.goto("/login");
    await signInFromLoginPage(page, uniqueEmail("mobile-un-nom-de-compte-tres-long-sans-espace"));
    await completeOnboarding(page, "Mobile");
    await page.getByRole("link", { name: "Voir mon menu" }).click();
    await page.getByTestId("week-title").waitFor();
    await page.getByRole("heading", { level: 1 }).filter({ hasText: "Camille" }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
