import { expect, test } from "@playwright/test";
import { signInFromLoginPage, supabaseConfigured, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// §8.6 et critère de M11 : la semaine s'imprime sur une seule page A4.
test.skip(!supabaseConfigured, "Supabase n'est pas configuré (voir .env.example)");
test.skip(({ isMobile, browserName }) => isMobile || browserName !== "chromium", "PDF généré par Chromium");

test("la vue imprimable tient sur une page A4", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("print"));
  await completeOnboarding(page, "Imprimeurs");

  await page.goto("/app");
  await page.getByRole("link", { name: "Imprimer la semaine" }).click();
  await expect(page).toHaveURL(/\/app\/print\?week=/);
  const sheet = page.getByTestId("print-sheet");
  await expect(sheet).toContainText("Menu de la semaine du");
  await expect(sheet).toContainText("Batch cooking");
  await expect(sheet).toContainText("Petits-déjeuners");
  // La navigation et les boutons ne s'impriment pas.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Imprimer" })).toBeHidden();

  const pdf = (await page.pdf({ format: "A4", preferCSSPageSize: true })).toString("latin1");
  const pages = pdf.match(/\/Type\s*\/Page(?!s)/g) ?? [];
  expect(pages).toHaveLength(1);
});
