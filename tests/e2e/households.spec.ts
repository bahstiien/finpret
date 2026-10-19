import { expect, test } from "@playwright/test";
import {
  canSendLoginEmail,
  signInFromLoginPage,
  submitLoginForm,
  supabaseConfigured,
  uniqueEmail,
} from "./helpers/auth";

// Parcours du jalon M1 : nécessite un Supabase (projet hébergé de développement ou local en CI) et .env.local.
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

test("connexion par lien magique, création du foyer, invitation et adhésion", async ({ browser }) => {
  const adminEmail = uniqueEmail("admin");
  const guestEmail = uniqueEmail("invite");

  // 1. L'administrateur se connecte et crée son foyer.
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/login");
  await signInFromLoginPage(admin, adminEmail);
  await expect(admin).toHaveURL(/\/onboarding$/);
  await admin.getByLabel("Nom du foyer").fill("Les Martin");
  await admin.getByRole("button", { name: "Créer le foyer" }).click();
  await expect(admin).toHaveURL(/\/app$/);
  await expect(admin.getByTestId("active-household")).toHaveText("Les Martin");
  await expect(admin.getByText("Administrateur")).toBeVisible();

  // 2. Il crée une invitation « Membre ».
  await admin.getByRole("link", { name: "Réglages du foyer" }).click();
  await admin.getByLabel("Rôle de la personne invitée").selectOption("member");
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
  await expect(guest.getByTestId("active-household")).toHaveText("Les Martin");
  await expect(guest.getByText("Membre", { exact: true })).toBeVisible();

  // 4. L'invitation a servi : elle n'est plus en attente et le lien est refusé.
  await admin.reload();
  await expect(admin.getByText("Aucune invitation en attente.")).toBeVisible();
  const third = await (await browser.newContext()).newPage();
  await third.goto(link);
  await expect(third.getByRole("alert").filter({ hasText: "déjà servi" })).toBeVisible();

  // 5. Un membre ne gère pas les invitations.
  await guest.goto("/settings/household");
  await expect(guest.getByText("Seul un administrateur peut gérer")).toBeVisible();
  await expect(guest.getByRole("button", { name: "Créer le lien" })).toHaveCount(0);
});

test("le dernier administrateur ne peut pas quitter son foyer", async ({ page }) => {
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("solo"));
  await page.getByLabel("Nom du foyer").fill("Solo");
  await page.getByRole("button", { name: "Créer le foyer" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/settings/household");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Quitter ce foyer" }).click();
  // Le message d'erreur, et non l'annonceur de route de Next.js (lui aussi role="alert").
  await expect(page.getByRole("alert").filter({ hasText: "au moins un administrateur" })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/household$/);
});
