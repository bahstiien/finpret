import { expect, type Page, test } from "@playwright/test";
import { adminDb, dbConfigured, householdIdOf, signInFromLoginPage, uniqueEmail, userIdOf } from "./helpers/auth";

// Réglages › Abonnement : offre, paiement, carte, résiliation, factures. Les appels Stripe qui exigent un compte
// réel (liste des factures, carte) sont vérifiés sur leur repli ; seule la création d'un Checkout (clé de test) part vers Stripe.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

/** Connexion, puis foyer créé directement en base : l'écran testé ne dépend pas de l'onboarding. */
async function signUpWithHousehold(page: Page, name: string, role: "admin" | "member" = "admin") {
  const email = uniqueEmail("abonnement");
  await page.goto("/login");
  await signInFromLoginPage(page, email);
  const userId = await userIdOf(email);
  const household = await adminDb()
    .insertInto("households")
    .values({ name, created_by: userId, onboarded_at: new Date().toISOString() })
    .returning("id")
    .executeTakeFirstOrThrow();
  await adminDb().insertInto("memberships").values({ household_id: household.id, user_id: userId, role }).execute();
  return email;
}

test("l'ancienne adresse redirige vers Réglages et l'essai propose les deux formules", async ({ page }) => {
  await signUpWithHousehold(page, "Famille Essai");
  await page.goto("/app/abonnement?ok=1");
  await expect(page).toHaveURL(/\/settings\/subscription\?ok=1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Réglages" }).getByRole("link", { name: "Abonnement" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("offer-status")).toContainText("Essai gratuit jusqu'au");
  await expect(page.getByText("Merci ! Ton abonnement est en cours d'activation.")).toBeVisible();
  await expect(page.getByTestId("choose-monthly")).toBeVisible();
  await expect(page.getByTestId("choose-yearly")).toBeVisible();
  const legal = page.getByTestId("legal-links");
  await expect(legal.getByRole("link", { name: "Conditions générales de vente" })).toHaveAttribute(
    "href",
    "/cgv",
  );
  await expect(legal.getByRole("link", { name: "Confidentialité" })).toHaveAttribute(
    "href",
    "/confidentialite",
  );
});

test("le paiement part vers Stripe Checkout", async ({ page }) => {
  // Checkout exige une URL des conditions d'utilisation dans le Dashboard Stripe (Paramètres › Informations publiques,
  // ex. https://<domaine>/cgv) : sans elle, Stripe refuse la session (consent_collection). À activer une fois configuré.
  test.skip(
    !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !process.env.STRIPE_CHECKOUT_E2E,
    "Checkout Stripe : définir STRIPE_CHECKOUT_E2E=1 avec une clé sk_test_ et l'URL des CGV dans le Dashboard",
  );
  await signUpWithHousehold(page, "Famille Paiement");
  await page.goto("/settings/subscription");
  await page.getByTestId("choose-monthly").click();
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30_000 });
});

test("un abonnement actif affiche l'échéance, un paiement refusé et le repli sans Stripe", async ({
  page,
}) => {
  const email = await signUpWithHousehold(page, "Famille Abonnée");
  const householdId = await householdIdOf(email);
  const suffix = Date.now().toString(36);
  const periodEnd = new Date(Date.now() + 20 * 86_400_000).toISOString();
  await adminDb()
    .updateTable("subscriptions")
    .set({
      plan: "monthly",
      status: "past_due",
      current_period_end: periodEnd,
      stripe_customer_id: `cus_e2e_${suffix}`,
      stripe_subscription_id: `sub_e2e_${suffix}`,
    })
    .where("household_id", "=", householdId)
    .execute();

  await page.goto("/settings/subscription");
  await expect(page.getByTestId("offer-status")).toContainText("Abonnement mensuel actif");
  await expect(page.getByText("Ton dernier paiement a été refusé")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mettre à jour la carte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gérer mon abonnement" })).toBeVisible();
  // Clés fictives : Stripe refuse, l'écran reste utilisable et le dit.
  await expect(page.getByText("Tes factures sont momentanément indisponibles.")).toBeVisible();
  await expect(
    page.getByText("Les détails de ton abonnement sont momentanément indisponibles."),
  ).toBeVisible();
});

test("un membre n'a qu'un message : ni paiement, ni factures", async ({ page }) => {
  await signUpWithHousehold(page, "Famille Membre", "member");
  await page.goto("/settings/subscription");
  await expect(page.getByText("Seul l'administrateur du foyer gère l'abonnement")).toBeVisible();
  await expect(page.getByTestId("choose-monthly")).toHaveCount(0);
  await expect(page.getByText("Paiements et factures")).toHaveCount(0);
});
