import { expect, type Page, test } from "@playwright/test";
import { FEATURES } from "../../src/lib/features";
import { dbConfigured, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// Jalon M6 (§8.3) : deux navigateurs sur le même foyer.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

const item = (page: Page, name: string) => page.getByTestId("shopping-item").filter({ hasText: name });

test("courses partagées : temps réel, ajouts simultanés, hors ligne", async ({ browser }) => {
  test.setTimeout(150_000);
  // Un foyer avec deux comptes.
  const a = await (await browser.newContext()).newPage();
  await a.goto("/login");
  await signInFromLoginPage(a, uniqueEmail("courses-a"));
  await completeOnboarding(a, "Courses");
  await a.goto("/settings/household");
  await a.getByLabel("Rôle de la personne invitée").selectOption("member");
  await a.getByRole("button", { name: "Créer le lien" }).click();
  const link = await a.getByLabel("Lien à envoyer").inputValue();
  const bContext = await browser.newContext();
  const b = await bContext.newPage();
  await b.goto(link);
  await b.getByRole("link", { name: "Se connecter pour rejoindre" }).click();
  await signInFromLoginPage(b, uniqueEmail("courses-b"));
  await b.getByRole("button", { name: "Rejoindre le foyer" }).click();
  await expect(b).toHaveURL(/\/app$/);

  await a.goto("/app/shopping");
  await b.goto("/app/shopping");
  const progressA = a.getByTestId("shopping-progress");
  await expect(progressA).toHaveText(/^0 \/ \d+ articles$/);
  const total = Number((await progressA.innerText()).split("/")[1]!.trim().split(" ")[0]);
  expect(total).toBeGreaterThan(5);
  // Laisse les abonnements temps réel s'établir.
  await a.waitForTimeout(1500);

  // 1. Une coche apparaît chez l'autre en moins de 2 s.
  const first = a.getByTestId("shopping-item").first();
  const firstName = (await first.locator("span.font-semibold").innerText()).trim();
  await first.getByRole("checkbox").check();
  await expect(item(b, firstName).getByRole("checkbox")).toBeChecked({ timeout: 2_000 });

  // 2. Ajouts simultanés : les deux articles sont gardés, chez les deux.
  await Promise.all([
    (async () => {
      await a.getByLabel("Article à ajouter").fill("Lessive");
      await a.getByRole("button", { name: "Ajouter", exact: true }).click();
    })(),
    (async () => {
      await b.getByLabel("Article à ajouter").fill("Café");
      await b.getByRole("button", { name: "Ajouter", exact: true }).click();
    })(),
  ]);
  for (const page of [a, b]) {
    await expect(item(page, "Lessive")).toBeVisible({ timeout: 3_000 });
    await expect(item(page, "Café")).toBeVisible({ timeout: 3_000 });
  }
  await expect(item(a, "Café")).toContainText("ajouté par");
  await expect(progressA).toHaveText(`1 / ${total + 2} articles`);

  // 3. Hors ligne : écriture avec rejeu REPORTÉE (SPEC_JANVIER) ; la lecture reste possible.
  if (!FEATURES.offlineWrites) {
    await bContext.setOffline(true);
    await expect(b.getByTestId("offline")).toContainText("Hors ligne : tu peux consulter");
    await expect(item(b, "Lessive")).toBeVisible();
    await bContext.setOffline(false);
    return;
  }
  {
    // 3. Hors ligne puis reconnexion sans perte.
    await bContext.setOffline(true);
    await expect(b.getByTestId("offline")).toContainText("Hors ligne");
    const second = b
      .getByTestId("shopping-item")
      .filter({ hasNotText: firstName })
      .filter({ hasNotText: "Lessive" })
      .filter({ hasNotText: "Café" })
      .first();
    const secondName = (await second.locator("span.font-semibold").innerText()).trim();
    await second.getByRole("checkbox").check();
    await b.getByLabel("Article à ajouter").fill("Piles");
    await b.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(b.getByTestId("offline")).toContainText("2 modifications en attente");
    // Pendant la coupure, l'autre appareil ne voit rien.
    await a.waitForTimeout(1500);
    await expect(item(a, "Piles")).toHaveCount(0);
    await bContext.setOffline(false);
    await expect(b.getByTestId("offline")).toHaveCount(0, { timeout: 10_000 });
    await expect(item(a, "Piles")).toBeVisible({ timeout: 5_000 });
    await expect(item(a, secondName).getByRole("checkbox")).toBeChecked({ timeout: 5_000 });

    // Après rechargement, rien n'est perdu.
    await b.reload();
    await expect(item(b, "Piles")).toBeVisible();
    await expect(item(b, secondName).getByRole("checkbox")).toBeChecked();
    await expect(b.getByTestId("shopping-progress")).toHaveText(`2 / ${total + 3} articles`);
  }
});
