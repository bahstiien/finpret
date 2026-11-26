import { expect, test } from "@playwright/test";
import { dbConfigured, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// Jalon M5 (§8.1, §8.7) : Générer, Changer, Déplacer, Retirer, Convives et Week-end.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.describe.configure({ mode: "parallel" });

test("écran Menu : générer, changer, retirer, déplacer, convives, week-end", async ({ page, isMobile }) => {
  test.skip(isMobile, "parcours joué sur le projet desktop");
  test.setTimeout(120_000);
  const toast = page.getByTestId("toast");
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("menu"));
  await completeOnboarding(page, "Menu");
  await page.getByRole("link", { name: "Ouvrir ma semaine" }).click();
  await expect(page.getByTestId("summary-meals")).toHaveText("10");

  // Semaine pas encore commencée : la vue « Organiser » (grille et plats) s'ouvre d'office.
  await expect(page.getByTestId("menu-mode").getByRole("button", { name: "Organiser" })).toHaveAttribute("aria-pressed", "true");

  // Générer un nouveau menu (menu ••• de l'en-tête).
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Plus d'actions" }).click();
  await page.getByRole("button", { name: "Générer un nouveau menu" }).click();
  await expect(toast).toContainText("Nouveau menu prêt");

  // Toucher un plat ouvre sa fiche : ingrédients, matériel, étapes.
  const firstDish = page.getByTestId("dishes").getByRole("listitem").first();
  await firstDish.getByRole("button", { name: /^Voir la recette/ }).click();
  const recipe = page.getByTestId("recipe-sheet");
  await expect(recipe.getByRole("heading", { name: "Ingrédients" })).toBeVisible();
  await expect(recipe.getByRole("heading", { name: "Étapes" })).toBeVisible();
  // Pas de retours sur un plat pas encore mangé.
  await expect(recipe.getByRole("button", { name: /^À refaire/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Changer le premier plat.
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

  // Retirer puis remettre le dîner du lundi depuis la grille.
  await page.getByRole("button", { name: /^lundi soir : .+à table/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ne rien prévoir" }).click();
  await expect(toast).toContainText("Rien de prévu lundi soir");
  await expect(page.getByTestId("summary-meals")).toHaveText("9");
  await page.getByRole("button", { name: /^lundi soir : plat du batch retiré/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remettre le plat du batch" }).click();
  await expect(toast).toContainText("Repas de nouveau prévu lundi soir");
  await expect(page.getByTestId("summary-meals")).toHaveText("10");

  // Déplacer le dîner du lundi vers un créneau autorisé.
  await page.getByRole("button", { name: /^lundi soir : .+à table/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Déplacer ce repas" }).click();
  const moveSheet = page.getByRole("dialog");
  await expect(moveSheet.getByRole("radio").first()).toBeVisible();
  await moveSheet.getByRole("radio", { disabled: false }).first().check();
  await moveSheet.getByRole("button", { name: "Déplacer ici" }).click();
  await expect(toast).toContainText("Repas échangés");

  // Qui est à table ? Un adulte de plus au déjeuner du lundi.
  await page.getByRole("button", { name: /^lundi midi : .+à table/ }).click();
  const guests = page.getByRole("dialog");
  await guests.getByRole("button", { name: "Adultes : plus" }).click();
  await guests.getByRole("button", { name: /^Valider · 3 parts$/ }).click();
  await expect(toast).toContainText("Convives enregistrés");
  await expect(page.getByRole("button", { name: /^lundi midi : .+, 3 à table/ })).toBeVisible();

  // « Cette semaine » : le carrousel en lecture, une carte de repas ouvre la même fiche.
  await page.getByTestId("menu-mode").getByRole("button", { name: "Cette semaine" }).click();
  await page.getByTestId("meal-1-dinner").click();
  await expect(page.getByTestId("recipe-sheet").getByRole("heading", { name: "Étapes" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("menu-mode").getByRole("button", { name: "Organiser" }).click();

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
    test.skip(!dbConfigured, "Postgres n'est pas configuré");
    test.setTimeout(90_000);
    await page.goto("/login");
    await signInFromLoginPage(page, uniqueEmail("mobile-un-nom-de-compte-tres-long-sans-espace"));
    await completeOnboarding(page, "Mobile");
    await page.getByRole("link", { name: "Ouvrir ma semaine" }).click();
    await page.getByTestId("week-title").waitFor();
    await page.getByTestId("menu-greeting").filter({ hasText: "Camille" }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("plat choisi sur un créneau de semaine : dans la session par défaut, bascule « le jour même »", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "parcours joué sur le projet desktop");
  test.setTimeout(120_000);
  const toast = page.getByTestId("toast");
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("jour-meme"));
  await completeOnboarding(page, "Jour");
  await page.getByRole("link", { name: "Ouvrir ma semaine" }).click();

  // Retirer le dîner du lundi puis y choisir un plat (un soir simple, lui, reste cuisiné le jour même).
  await page.getByRole("button", { name: /^lundi soir : .+à table/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ne rien prévoir" }).click();
  await expect(toast).toContainText("Rien de prévu lundi soir");
  await page.getByRole("button", { name: /^lundi soir : plat du batch retiré/ }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "Toutes" }).click();
  await picker.getByRole("searchbox").fill("Chili de dinde et patate douce");
  await picker.getByRole("radio").first().check();
  await picker.getByRole("button", { name: /^Mettre .+ lundi soir$/ }).click();
  await expect(toast).toContainText(/ prévu lundi soir\.$/);

  // Le plat rejoint la session : il est dans « Plats de la semaine », hors « le jour même ».
  const name = (await toast.innerText()).replace(/ prévu lundi soir\.$/, "").trim();
  const row = page.getByTestId("dishes").getByRole("listitem").filter({ hasText: name });
  await expect(row.getByRole("button", { name: /le jour même/ })).toHaveAttribute("aria-pressed", "false");

  await row.getByRole("button", { name: /le jour même/ }).click();
  await expect(toast).toContainText("cuisiné le jour même");
  const freshRow = page.getByTestId("dishes").getByRole("listitem").filter({ hasText: "Le jour même, lundi soir" });
  await expect(freshRow.getByRole("button", { name: /le jour même/ })).toHaveAttribute("aria-pressed", "true");

  await freshRow.getByRole("button", { name: /le jour même/ }).click();
  await expect(toast).toContainText("préparé pendant la session");
  await expect(page.getByTestId("dishes").getByText("Le jour même, lundi soir")).toHaveCount(0);
  await expect(row.getByRole("button", { name: /le jour même/ })).toHaveAttribute("aria-pressed", "false");
});
