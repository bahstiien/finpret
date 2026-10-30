import { expect, test } from "@playwright/test";
import { dbConfigured, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { FEATURES } from "../../src/lib/features";
import { completeOnboarding } from "./helpers/onboarding";

// Jalon M8 (§8.5) : session complète, minuteurs persistants entre les onglets, état partagé.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

test("session complète, minuteurs persistants, état partagé entre appareils", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("session"));
  await completeOnboarding(page, "Session");

  await page.goto("/app/session");
  await expect(page.getByTestId("session-start")).toContainText("étapes");
  await page.getByRole("button", { name: "Commencer la session" }).click();
  const stepCard = page.getByTestId("session-step");
  await expect(stepCard).toBeVisible();
  const total = Number((await page.getByText(/^Étape 1 sur \d+$/).innerText()).split(" sur ")[1]);
  expect(total).toBeGreaterThan(6);

  // Un second appareil du même compte suit l'étape en cours.
  const other = await context.newPage();
  await other.goto("/app/session");
  await expect(other.getByText(`Étape 1 sur ${total}`)).toBeVisible();

  let timerLaunched = false;
  for (let i = 1; i <= total; i++) {
    await expect(page.getByText(`Étape ${i} sur ${total}`)).toBeVisible();
    const boxes = stepCard.getByRole("checkbox");
    for (let j = 0; j < (await boxes.count()); j++) await boxes.nth(j).check();
    const next = page.getByRole("button", { name: /^Étape suivante/ });
    if (i < total) await expect(next).toHaveAttribute("data-ready", "true");

    const timer = stepCard.getByRole("button", { name: /^Lancer le minuteur de \d+ min$/ });
    if (!timerLaunched && (await timer.count())) {
      await timer.click();
      timerLaunched = true;
      await expect(page.getByTestId("timer-bar")).toBeVisible();
      // Le minuteur reste affiché sur les autres onglets.
      await page.getByRole("link", { name: "Menu" }).first().click();
      await expect(page).toHaveURL(/\/app$/);
      await expect(page.getByTestId("timer-bar")).toBeVisible();
      await page.goto("/app/shopping");
      await expect(page.getByTestId("timer-bar")).toBeVisible();
      await page.goto("/app/session");
      await expect(page.getByText(`Étape ${i} sur ${total}`)).toBeVisible();
    }
    if (i === 2 && FEATURES.sharedSession)
      await expect(other.getByText(`Étape 2 sur ${total}`)).toBeVisible({ timeout: 5_000 });
    if (i < total) await next.click();
  }
  expect(timerLaunched).toBe(true);

  // Dernière étape : ranger les restes au garde-manger.
  await expect(page.getByRole("button", { name: "Session terminée" })).toBeDisabled();
  if (FEATURES.freezerAndLeftovers) {
    await page.getByRole("button", { name: "Mettre à jour le garde-manger" }).click();
    await expect(page.getByTestId("toast")).toContainText("Garde-manger mis à jour");
  }

  // Minuteur arrivé à échéance (horloge simulée) : pilule « prêt », puis OK.
  const clockPage = await context.newPage();
  await clockPage.clock.install();
  // Les recettes cuisinées ont pu rapporter des tampons : leur célébration s'ouvre sur /app, par-dessus le minuteur.
  await clockPage.addLocatorHandler(clockPage.getByRole("dialog"), async (dialog) => {
    // Deux « Fermer » : la croix de l'en-tête et le bouton du bas.
    await dialog.getByRole("button", { name: "Fermer" }).first().click();
  });
  await clockPage.goto("/app");
  await expect(clockPage.getByTestId("timer-bar")).toBeVisible();
  await clockPage.clock.fastForward("02:00:00");
  await expect(clockPage.getByTestId("timer-bar").getByText(/: prêt !$/)).toBeVisible();
  await clockPage.getByTestId("timer-bar").getByRole("button", { name: "OK" }).click();
  await expect(clockPage.getByTestId("timer-bar")).toHaveCount(0, { timeout: 10_000 });
});
