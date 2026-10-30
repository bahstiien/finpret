import { expect, test } from "@playwright/test";
import { dbConfigured, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { FEATURES } from "../../src/lib/features";
import { completeOnboarding } from "./helpers/onboarding";

// Jalon M7 (§8.4) : le garde-manger réduit la liste ; les restes sont ajoutés après la session.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

test("garde-manger, restes après la session et congélateur", async ({ page }) => {
  test.setTimeout(120_000);
  const toast = page.getByTestId("toast");
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("stock"));
  await completeOnboarding(page, "Stock");

  // Un article de la liste de courses.
  await page.goto("/app/shopping");
  const progress = page.getByTestId("shopping-progress");
  await expect(progress).toHaveText(/^0 \/ \d+ articles$/);
  const total = Number((await progress.innerText()).split("/")[1]!.trim().split(" ")[0]);
  const first = page.getByTestId("shopping-item").first();
  const name = (await first.locator("span.font-semibold").innerText()).trim();

  // « Assez » au garde-manger : l'article quitte la liste.
  await page.goto("/app/stock");
  await page.getByLabel("Ajouter un ingrédient").fill(name);
  await page.getByRole("button", { name: `+ ${name}`, exact: true }).click();
  await expect(toast).toContainText("Garde-manger mis à jour");
  await expect(page.getByTestId("pantry")).toContainText(`${name} : Assez`);
  await page.goto("/app/shopping");
  await expect(progress).toHaveText(`0 / ${total - 1} articles`);
  await expect(page.getByTestId("shopping-item").filter({ hasText: name })).toHaveCount(0);

  if (!FEATURES.freezerAndLeftovers) return; // Restes et congélateur REPORTÉS (SPEC_JANVIER).

  // Après la session : les restes de contenants entrent au garde-manger.
  await page.goto("/app/stock");
  const before = await page.getByTestId("pantry").getByRole("listitem").count();
  await page.getByRole("button", { name: "Mettre à jour le garde-manger" }).click();
  await expect(toast).toContainText(/Garde-manger mis à jour : [1-9]\d* restes? ajoutés?/);
  await expect(page.getByRole("button", { name: "Mettre à jour le garde-manger" })).toHaveCount(0);
  expect(await page.getByTestId("pantry").getByRole("listitem").count()).toBeGreaterThan(before);

  // Congélateur : ajout d'un plat, puis un repas en moins.
  const freezer = page.getByTestId("freezer");
  await page.getByLabel("Ajouter un plat congelé").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Ajouter 2 repas" }).click();
  await expect(toast).toContainText("2 repas ajoutés au congélateur");
  await expect(freezer).toContainText("2 repas");
  await freezer
    .getByRole("button", { name: /: moins$/ })
    .first()
    .click();
  await expect(toast).toContainText("1 repas au congélateur");
  await expect(freezer).toContainText("1 repas");
});
