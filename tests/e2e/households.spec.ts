import { expect, test } from "@playwright/test";
import { FEATURES } from "../../src/lib/features";
import {
  canSendLoginEmail,
  signInFromLoginPage,
  submitLoginForm,
  supabaseConfigured,
  uniqueEmail,
} from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// Parcours des jalons M1 et M4 : nécessite un Supabase (projet hébergé de développement ou local en CI) et .env.local.
test.skip(!supabaseConfigured, "Supabase n'est pas configuré (voir .env.example)");
// Un seul navigateur suffit : ces parcours testent le serveur et la base, pas la mise en page.
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

test("une page de l'application demande une connexion", async ({ page }) => {
  await page.goto("/app/shopping");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fshopping$/);
});

test("le formulaire envoie le lien de connexion", async ({ page }) => {
  test.skip(!canSendLoginEmail, "envoi d'e-mails limité sur le projet hébergé : vérifié en CI");
  await page.goto("/login");
  await submitLoginForm(page, uniqueEmail("formulaire"));
});

test("premier menu après l'onboarding (§5)", async ({ page }) => {
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("onboarding"));
  await completeOnboarding(page, "Les Dupont");
  // 4 plats de batch (dîner + déjeuner du lendemain) et une soupe sur 2 soirs : 10 repas.
  const recap = page.getByTestId("onboarding-recap");
  await expect(recap).toContainText("10");
  await expect(recap).toContainText("repas prévus");
  await page.getByRole("link", { name: "Voir mon menu" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("week-title")).toContainText("Semaine du");
  await expect(page.getByTestId("summary-meals")).toHaveText("10");
  await expect(page.getByTestId("week-summary")).toContainText("Session");
  await expect(page.getByRole("button", { name: /^Changer / }).first()).toBeVisible();
  await expect(page.getByTestId("dishes").getByRole("listitem")).toHaveCount(5); // 4 plats et la soupe
});

test("connexion par lien magique, invitation et adhésion ; le paramétrage reste à l'administrateur", async ({
  browser,
}) => {
  const adminEmail = uniqueEmail("admin");
  const guestEmail = uniqueEmail("invite");

  // 1. L'administrateur se connecte et configure son foyer.
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/login");
  await signInFromLoginPage(admin, adminEmail);
  await completeOnboarding(admin, "Les Martin");

  // 2. Il invite une personne en lecture seule.
  await admin.goto("/settings/household");
  await admin
    .getByLabel("Rôle de la personne invitée")
    .selectOption(FEATURES.viewerRole ? "viewer" : "member");
  await admin.getByLabel(/E-mail/).fill(guestEmail);
  await admin.getByRole("button", { name: "Créer le lien" }).click();
  const link = await admin.getByLabel("Lien à envoyer").inputValue();
  expect(link).toMatch(/\/join\/[0-9a-f]{48}$/);
  await expect(admin.getByTestId("pending-invitations")).toContainText(guestEmail);

  // 3. La personne invitée ouvre le lien, se connecte puis rejoint le foyer.
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("Rejoindre « Les Martin »");
  await guest.getByRole("link", { name: "Se connecter pour rejoindre" }).click();
  await signInFromLoginPage(guest, guestEmail);
  await expect(guest).toHaveURL(new URL(link).pathname);
  await guest.getByRole("button", { name: "Rejoindre le foyer" }).click();
  await expect(guest).toHaveURL(/\/app$/);
  await expect(guest.getByTestId("week-title")).toContainText("Semaine du");
  if (FEATURES.viewerRole) await expect(guest.getByRole("button", { name: /^Changer / })).toHaveCount(0); // lecture seule
  await expect(guest.getByTestId("summary-meals")).toHaveText("10");

  // 4. L'invitation a servi : elle n'est plus en attente et le lien est refusé.
  await admin.reload();
  await expect(admin.getByText("Aucune invitation en attente.")).toBeVisible();
  const third = await (await browser.newContext()).newPage();
  await third.goto(link);
  await expect(third.getByRole("alert").filter({ hasText: "déjà servi" })).toBeVisible();

  if (FEATURES.viewerRole) {
    // 5. Lecture seule : seule la section Profil est accessible (§6).
    for (const section of ["/settings", "/settings/household", "/settings/menu", "/settings/data"]) {
      await guest.goto(section);
      await expect(guest).toHaveURL(/\/settings\/profile$/);
    }
    await expect(guest.getByRole("navigation", { name: "Réglages" }).getByRole("link")).toHaveText([
      "Profil",
    ]);
    const exported = await guest.request.get("/settings/data/export");
    expect(exported.status()).toBe(403);
  }
});

test("un réglage s'enregistre tout seul et peut s'appliquer à la semaine préparée (§6)", async ({ page }) => {
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("reglages"));
  await completeOnboarding(page, "Réglages");
  await page.goto("/settings/menu");
  await page.getByRole("button", { name: "Soirs légers : plus" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Enregistré" })).toBeVisible();
  await expect(page.getByText(/Appliquer ce changement à la semaine du/)).toBeVisible();
  await page.getByRole("button", { name: "Appliquer à cette semaine" }).click();
  await expect(page.getByText("Semaine recomposée avec tes nouveaux réglages.")).toBeVisible({
    timeout: 30_000,
  });
  await page.goto("/app");
  await expect(page.getByTestId("summary-meals")).toHaveText("10");

  // L'export des données du foyer est disponible pour l'administrateur ; la semaine a été recomposée :
  // 3 soirs légers = la soupe sur 2 soirs et 1 soir simple (2 soirs légers auparavant, tous en soupe).
  const exported = await page.request.get("/settings/data/export");
  expect(exported.ok()).toBe(true);
  const body = await exported.json();
  expect(body.household.name).toBe("Réglages");
  expect(body.settings.menu.light).toBe(3);
  expect(body.weeks).toHaveLength(1);
  expect(body.weeks[0].plan.soup.days).toHaveLength(2);
  expect(body.weeks[0].plan.simples).toHaveLength(1);
});

test("le dernier administrateur ne peut pas quitter son foyer", async ({ page }) => {
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("solo"));
  await completeOnboarding(page, "Solo");
  await page.goto("/settings/profile");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Quitter ce foyer" }).click();
  // Le message d'erreur, et non l'annonceur de route de Next.js (lui aussi role="alert").
  await expect(page.getByRole("alert").filter({ hasText: "au moins un administrateur" })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/profile$/);
});
