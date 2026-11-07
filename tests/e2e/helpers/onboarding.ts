import { expect, type Page } from "@playwright/test";

/** Écran de bienvenue puis étape Foyer : le nom du foyer et deux adultes (le compte, puis `secondAdult`). */
export async function fillHousehold(page: Page, householdName: string, secondAdult = "Julien") {
  await expect(page).toHaveURL(/\/onboarding$/);
  await acceptTermsIfAsked(page);
  await page.getByRole("button", { name: "Commencer" }).click();
  const first = page.getByLabel("Prénom (Adulte 1)");
  if (!(await first.inputValue())) await first.fill("Camille");
  await page.getByRole("button", { name: "Adultes : plus" }).click();
  await page.getByLabel("Prénom (Adulte 2)").fill(secondAdult);
  await page.getByLabel("Nom du foyer").fill(householdName);
}

/** Compte ouvert par lien magique : écran d'accord sur les CGU avant le parcours (une seule fois par compte). */
export async function acceptTermsIfAsked(page: Page) {
  const gate = page.getByTestId("terms-gate");
  await expect(page.getByRole("button", { name: "Commencer" }).or(gate)).toBeVisible();
  if (!(await gate.isVisible())) return;
  await gate.getByTestId("terms").check();
  await gate.getByRole("button", { name: "Continuer" }).click();
  await expect(gate).toBeHidden();
}

/** Envoie le parcours depuis l'étape Rythme et attend le récapitulatif. */
export async function finishOnboarding(page: Page) {
  await page.getByRole("button", { name: "Préparer ma semaine" }).click();
  await expect(page.getByRole("heading", { name: "Ta semaine est fin prête." })).toBeVisible({
    timeout: 30_000,
  });
}

/** Termine l'onboarding en gardant les valeurs par défaut (§5), depuis la page /onboarding. */
export async function completeOnboarding(page: Page, householdName: string, secondAdult = "Julien") {
  await fillHousehold(page, householdName, secondAdult);
  // Foyer, Envies, Restrictions : Continuer ; Rythme : Préparer ma semaine.
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuer" }).click();
  await finishOnboarding(page);
}
