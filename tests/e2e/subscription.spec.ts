import { expect, type Page, test } from "@playwright/test";
import {
  adminDb,
  createUser,
  dbConfigured,
  householdIdOf,
  signInFromLoginPage,
  uniqueEmail,
  userIdOf,
} from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// Réglages › Abonnement : offre, paiement, carte, résiliation, factures. Les appels Stripe qui exigent un compte
// réel (liste des factures, carte) sont vérifiés sur leur repli ; seule la création d'un Checkout (clé de test) part vers Stripe.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

async function signUpWithHousehold(page: Page, name: string) {
  const email = uniqueEmail("abonnement");
  await page.goto("/login");
  await signInFromLoginPage(page, email);
  await completeOnboarding(page, name);
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
  test.skip(
    !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
    "clé Stripe de test absente : le Checkout n'est pas créé",
  );
  await signUpWithHousehold(page, "Famille Paiement");
  await page.goto("/settings/subscription");
  await page.getByTestId("choose-monthly").click();
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
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
  const email = await signUpWithHousehold(page, "Famille Membre");
  const householdId = await householdIdOf(email);
  // Un foyer garde toujours un administrateur (garde-fou `last_admin`) : un second compte le devient d'abord.
  const otherAdmin = await createUser(uniqueEmail("admin-bis"));
  await adminDb()
    .insertInto("memberships")
    .values({ household_id: householdId, user_id: otherAdmin, role: "admin" })
    .execute();
  const userId = await userIdOf(email);
  await adminDb()
    .updateTable("memberships")
    .set({ role: "member" })
    .where("household_id", "=", householdId)
    .where("user_id", "=", userId)
    .execute();
  await page.goto("/settings/subscription");
  await expect(page.getByText("Seul l'administrateur du foyer gère l'abonnement")).toBeVisible();
  await expect(page.getByTestId("choose-monthly")).toHaveCount(0);
  await expect(page.getByText("Paiements et factures")).toHaveCount(0);
});
