import { expect, type Page } from "@playwright/test";
import { FEATURES } from "../../../src/lib/features";

/** Termine l'onboarding en gardant les valeurs par défaut (§5), depuis la page /onboarding. */
export async function completeOnboarding(page: Page, householdName: string, secondAdult = "Julien") {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Nom du foyer").fill(householdName);
  const names = page.getByLabel(/^Prénom/);
  if (!(await names.first().inputValue())) await names.first().fill("Camille");
  await names.nth(1).fill(secondAdult);
  for (let i = 0; i < (FEATURES.onboardingHabits ? 4 : 3); i++)
    await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Préparer ma semaine" }).click();
  await expect(page.getByRole("heading", { name: "Ta semaine est prête !" })).toBeVisible({
    timeout: 30_000,
  });
}
