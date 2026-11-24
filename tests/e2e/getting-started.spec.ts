import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { sql } from "kysely";
import { adminDb, dbConfigured, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// SPEC_PRISE_EN_MAIN §7.5 (J5b-1) : checklist « Ta première semaine » et bulles d'onglet.
// La Sheet de préparation (J5b-2) et l'Aide (J8b) ont leurs propres parcours.
test.skip(!dbConfigured, "DATABASE_URL n'est pas configurée (voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

async function signUp(page: Page, name: string) {
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail(name));
  await completeOnboarding(page, name);
  // Session dans 3 jours : hors veille, la Tile « Demain, ta première session » ne réduit pas la checklist.
  // Les parcours de la veille règlent eux-mêmes le jour (setSessionDay).
  await setSessionDay(page, 3);
  await page.goto("/app");
}

/** L'état est recalculé à chaque rendu de Menu : on recharge jusqu'à voir la progression attendue. */
async function expectProgress(page: Page, text: string) {
  await expect(async () => {
    await page.goto("/app");
    await expect(page.getByTestId("checklist-progress")).toHaveText(text, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test("nouveau foyer : checklist de « 1 sur 6 » à la réussite, puis disparition", async ({ page }) => {
  test.setTimeout(300_000);
  await signUp(page, "pec-parcours");

  const card = page.getByTestId("checklist");
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "Ta première semaine" })).toBeVisible();
  await expect(page.getByTestId("checklist-progress")).toHaveText("1 sur 6");
  await expect(card.locator('[data-step="discover_menu"]')).toHaveAttribute("data-done", "true");

  // Changer un repas.
  const firstDish = page.getByTestId("dishes").getByRole("listitem").first();
  // Le bouton est dans le HTML serveur avant l'hydratation : on retente le clic jusqu'à ce que l'action réponde.
  await expect(async () => {
    await firstDish.getByRole("button", { name: /^Changer / }).click();
    await expect(page.getByTestId("toast")).toContainText("remplacé par", { timeout: 6_000 });
  }).toPass({ timeout: 40_000 });
  await expectProgress(page, "2 sur 6");

  // Cocher une course.
  await page.goto("/app/shopping");
  // L'événement part en tâche de fond : on attend sa réponse avant de quitter la page (sinon la navigation l'annule).
  const recorded = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/app/shopping"));
  await page.getByTestId("shopping-item").first().getByRole("checkbox").check();
  await recorded;
  await expectProgress(page, "3 sur 6");

  // Lancer puis terminer la session.
  await page.goto("/app/session");
  // Première session : niveau « Débutant » présélectionné sur la carte de démarrage.
  await expect(page.getByTestId("first-session-level").getByRole("radio", { name: "Débutant" })).toBeChecked();
  const started = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/app/session"));
  await page.getByRole("button", { name: "Commencer ma session" }).click();
  await page.getByRole("button", { name: "Commencer", exact: true }).click();
  await started;
  const stepCard = page.getByTestId("session-step");
  const total = Number((await page.getByText(/^Étape 1 sur \d+$/).innerText()).split(" sur ")[1]);
  for (let i = 1; i <= total; i++) {
    // Les conseils de première session se ferment avec « Compris », comme le ferait une personne.
    const tip = page.getByTestId("coachmark");
    if (await tip.isVisible()) await tip.getByRole("button", { name: "Compris" }).click();
    const boxes = stepCard.getByRole("checkbox");
    for (let j = 0; j < (await boxes.count()); j++) await boxes.nth(j).check();
    if (i < total) {
      // Sous `next dev`, le clic peut partir avant l'enregistrement des coches : on retente jusqu'au changement d'étape.
      await expect(async () => {
        await page.getByRole("button", { name: /^Étape suivante/ }).click();
        await expect(page.getByText(`Étape ${i + 1} sur ${total}`)).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 60_000 });
    }
  }

  // Écran de fin de la première session : repas préparés, durée réelle, consigne.
  await expect(page.getByTestId("first-session-recap")).toContainText("Ta première session est faite");
  await expect(page.getByTestId("first-session-recap")).toContainText(/repas préparés?/);

  // Les cinq étapes obligatoires sont faites : message de réussite, puis la carte disparaît pour de bon.
  await expect(async () => {
    await page.goto("/app");
    await expect(page.getByTestId("checklist-success")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByTestId("checklist-success")).toContainText("Bravo, ta première semaine est bouclée");
  // La feuille de célébration des tampons (SPEC_PROGRES) peut être ouverte : on la ferme avant d'agir sur la carte.
  // Elle peut s'ouvrir après coup : on la ferme à chaque tentative avant de cliquer sur la carte.
  await expect(async () => {
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    await page.getByTestId("checklist-success").getByRole("button", { name: "Fermer" }).click({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("checklist-success")).toBeHidden();
  await page.reload();
  await expect(page.getByTestId("checklist")).toHaveCount(0);
  await expect(page.getByTestId("checklist-success")).toHaveCount(0);
});

test("« Je cuisine seul·e » valide l'étape facultative", async ({ page }) => {
  await signUp(page, "pec-seul");
  await page.getByRole("button", { name: "Je cuisine seul·e" }).click();
  await expect(page.getByTestId("toast")).toContainText("Tu cuisines seul·e");
  await expectProgress(page, "2 sur 6");
  await expect(page.locator('[data-step="invite"]')).toHaveAttribute("data-done", "true");
});

test("masquer la checklist puis annuler", async ({ page }) => {
  await signUp(page, "pec-masquer");
  await page.getByRole("button", { name: "Masquer, je me débrouille" }).click();
  await expect(page.getByTestId("toast")).toContainText("Checklist masquée");
  await expect(page.getByTestId("checklist")).toHaveCount(0);
  await page.getByTestId("toast").getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByTestId("checklist")).toBeVisible();
});

test("réduire et développer la carte au clavier", async ({ page }) => {
  await signUp(page, "pec-reduire");
  const toggle = page.getByRole("button", { name: "Réduire la carte" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Développer la carte" })).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Réduire la carte" })).toHaveAttribute("aria-expanded", "true");
});

test("bulle Courses : affichée une seule fois, mémorisée par compte", async ({ page }) => {
  await signUp(page, "pec-bulle");
  await page.goto("/app/shopping");
  const bubble = page.getByTestId("coachmark");
  await expect(bubble).toContainText("Ta liste est rangée par rayon");
  // La clé est mémorisée par une action serveur : on attend sa réponse avant de recharger.
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/app/shopping"));
  await bubble.getByRole("button", { name: "Compris" }).click();
  await expect(bubble).toBeHidden();
  await saved;
  await page.reload();
  await expect(page.getByTestId("coachmark")).toHaveCount(0);
});

test("bulle : Échap la ferme", async ({ page }) => {
  await signUp(page, "pec-echap");
  await page.goto("/app/discover");
  await expect(page.getByTestId("coachmark")).toBeVisible();
  // La bulle est dans le HTML serveur avant l'hydratation : on retente Échap jusqu'à ce que l'écouteur soit en place.
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("coachmark")).toBeHidden({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
});

test("accessibilité : Menu avec checklist et bulle, en clair et en sombre", async ({ page }) => {
  await signUp(page, "pec-axe");
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(page.getByTestId("coachmark")).toBeVisible();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // Les boutons ont une transition de couleur : on analyse une fois le thème installé.
    await page.waitForTimeout(700);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const summary = violations.map(
      (v) => `Menu (${scheme}) · ${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
    );
    expect(summary).toEqual([]);
  }
});

/** Règle le jour de session du foyer (0 = dimanche … 6 = samedi) : pas de manipulation d'horloge dans les tests. */
async function setSessionDay(page: Page, offsetDays: number) {
  await page.goto("/app");
  const cookies = await page.context().cookies();
  const household =
    cookies.find((c) => c.name === "active_household")?.value ??
    (await adminDb().selectFrom("households").select("id").orderBy("created_at", "desc").limit(1).executeTakeFirstOrThrow())
      .id;
  const weekday = new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "Europe/Paris",
  });
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  await adminDb()
    .updateTable("household_settings")
    .set({ session: sql`session || jsonb_build_object('day', ${day}::int)` })
    .where("household_id", "=", household)
    .execute();
  return household;
}

test("la veille de la session : Tile et Sheet de préparation", async ({ page }) => {
  test.setTimeout(240_000);
  await signUp(page, "pec-veille");
  const household = await setSessionDay(page, 1);
  await page.goto("/app");
  const tile = page.getByTestId("prep-tile");
  await expect(tile).toContainText("Demain, ta première session");
  // Une seule carte d'action : la checklist s'efface tant que la Tile est affichée.
  await expect(page.getByTestId("checklist")).toHaveCount(0);
  await tile.getByRole("button", { name: "Préparer ma session" }).click();
  const sheet = page.getByRole("dialog", { name: "Demain, ta première session" });
  await expect(sheet.getByTestId("prep-boxes-count")).toContainText(/boîtes? à prévoir : \d+ pour le frigo, \d+ pour le congélateur/);
  await expect(sheet).toContainText("Libère de la place");
  await expect(sheet).toContainText(/articles sur \d+ sont cochés|Tes courses sont faites/);
  await expect(sheet.getByTestId("prep-duration")).toContainText(/Compte .* fin prévue vers \d{2}:\d{2}/);
  await expect(sheet.getByRole("radio", { name: "Débutant" })).toBeChecked();
  const before = await sheet.getByTestId("prep-duration").innerText();
  await sheet.getByRole("radio", { name: "À l'aise" }).click();
  await expect(sheet.getByTestId("prep-duration")).not.toHaveText(before);
  await expect(async () => {
    const { n } = await adminDb()
      .selectFrom("events")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("household_id", "=", household)
      .where("name", "=", "prep_sheet_opened")
      .executeTakeFirstOrThrow();
    expect(Number(n)).toBeGreaterThan(0);
  }).toPass({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  // Plus tard : la Tile disparaît pour la journée.
  await tile.getByRole("button", { name: "Plus tard" }).click();
  await expect(tile).toBeHidden();
});

test("hors veille : pas de Tile", async ({ page }) => {
  await signUp(page, "pec-horsveille");
  await setSessionDay(page, 3);
  await page.goto("/app");
  await expect(page.getByTestId("checklist")).toBeVisible();
  await expect(page.getByTestId("prep-tile")).toHaveCount(0);
});

test("le lien ?prep=1 ouvre la Sheet de préparation", async ({ page }) => {
  await signUp(page, "pec-lien");
  await setSessionDay(page, 1);
  await page.goto("/app?prep=1");
  await expect(page.getByRole("dialog", { name: "Demain, ta première session" })).toBeVisible();
});

test("accessibilité : Tile et Sheet de préparation, en clair et en sombre", async ({ page }) => {
  await signUp(page, "pec-axe2");
  await setSessionDay(page, 1);
  await page.goto("/app?prep=1");
  const sheet = page.getByRole("dialog", { name: "Demain, ta première session" });
  await expect(sheet).toBeVisible();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // Les boutons ont une transition de couleur : on analyse une fois le thème installé.
    await page.waitForTimeout(700);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const summary = violations.map(
      (v) => `Sheet (${scheme}) · ${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
    );
    expect(summary).toEqual([]);
  }
  await page.keyboard.press("Escape");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // Les boutons ont une transition de couleur : on analyse une fois le thème installé.
    await page.waitForTimeout(700);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      violations.map((v) => `Tile (${scheme}) · ${v.id} : ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
    ).toEqual([]);
  }
});
