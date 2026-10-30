import { expect, type Page, test } from "@playwright/test";
import { adminDb, dbConfigured, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// SPEC_PROGRES §9 : série fin prête et passeport des saveurs (jalons G2 à G4).
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

const MONDAY_MS = 7 * 86_400_000;

/** Lundi (ISO) de la semaine contenant `now`, décalé de `weeks` semaines. */
function mondayOffset(weeks: number): string {
  const now = new Date();
  const wd = (now.getUTCDay() + 6) % 7;
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - wd);
  return new Date(monday + weeks * MONDAY_MS).toISOString().slice(0, 10);
}

async function signUp(page: Page, name: string) {
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail(name));
  await completeOnboarding(page, name);
}

/** Foyer du compte connecté (cookie actif), lu directement en base. */
async function householdId(page: Page): Promise<string> {
  await page.goto("/app");
  const cookies = await page.context().cookies();
  const active = cookies.find((c) => c.name === "active_household")?.value;
  if (active) return active;
  const row = await adminDb()
    .selectFrom("households")
    .select("id")
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirstOrThrow();
  return row.id;
}

async function seedStreak(household: string, weeks: number) {
  const rows = Array.from({ length: weeks }, (_, i) => ({
    household_id: household,
    week_start: mondayOffset(-(weeks - i)),
    outcome: "done" as const,
    closed_at: new Date().toISOString(),
  }));
  await adminDb()
    .insertInto("streak_weeks")
    .values(rows)
    .onConflict((oc) =>
      oc.columns(["household_id", "week_start"]).doUpdateSet((eb) => ({
        outcome: eb.ref("excluded.outcome"),
        closed_at: eb.ref("excluded.closed_at"),
      })),
    )
    .execute();
}

test("terminer une session : ligne de série à l'écran de réussite, « Nos progrès » affiche série et tampon", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signUp(page, "progres-session");
  await page.goto("/app/session");
  await page.getByRole("button", { name: "Commencer la session" }).click();
  const stepCard = page.getByTestId("session-step");
  const total = Number((await page.getByText(/^Étape 1 sur \d+$/).innerText()).split(" sur ")[1]);
  for (let i = 1; i <= total; i++) {
    const boxes = stepCard.getByRole("checkbox");
    for (let j = 0; j < (await boxes.count()); j++) await boxes.nth(j).check();
    if (i < total) await page.getByRole("button", { name: /^Étape suivante/ }).click();
  }
  await expect(page.getByTestId("session-streak")).toContainText("Ta première semaine fin prête");
  await page.goto("/app/progress");
  await expect(page.getByTestId("streak-current")).toContainText("1 semaine fin prête");
  await expect(page.getByTestId("passport-count")).toContainText(/\d+ pays sur 19/);
  await expect(page.locator('[data-testid="country-stamps"] [data-state="earned"]').first()).toBeVisible();
});

test("planifier une pause diminue les jetons, l'annuler les rend", async ({ page }) => {
  await signUp(page, "progres-pause");
  await page.goto("/app/progress");
  await expect(page.getByTestId("pauses-left")).toContainText("2 pauses disponibles");
  await page.getByTestId("plan-pause").click();
  const dialog = page.getByRole("dialog", { name: "Planifier une pause" });
  await dialog
    .getByRole("button", { name: /Planifier une pause$/ })
    .first()
    .click();
  await expect(page.getByTestId("toast")).toContainText("Pause posée");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pauses-left")).toContainText("1 pause disponible");
  await page.getByTestId("plan-pause").click();
  await dialog.locator('[data-planned="true"]').click();
  await expect(page.getByTestId("toast")).toContainText("Pause annulée");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pauses-left")).toContainText("2 pauses disponibles");
});

test("un tampon vide mène à Découvrir filtré par pays, avec « Mettre au menu »", async ({ page }) => {
  await signUp(page, "progres-stamp");
  await page.goto("/app/progress");
  const empty = page.locator('[data-testid="country-stamps"] [data-state="empty"]').first();
  await empty.click();
  await expect(page).toHaveURL(/\/app\/discover\?origin=[a-z]{2}$/);
  await expect(page.getByTestId("origin-chip")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mettre au menu" }).first()).toBeVisible();
});

test("masquer la série retire la tuile ; réafficher restitue l'historique", async ({ page }) => {
  await signUp(page, "progres-hide");
  const household = await householdId(page);
  await seedStreak(household, 3);
  await page.goto("/app");
  await expect(page.getByTestId("streak-tile")).toContainText("3 semaines");

  await page.goto("/settings/profile");
  // La case est masquée (interrupteur dessiné) : on clique son libellé, comme un utilisateur.
  const toggle = page.getByLabel("Afficher la série et le passeport");
  await page.getByText("Afficher la série et le passeport").click();
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText(/Enregistré/)).toBeVisible();
  await page.goto("/app");
  await expect(page.getByTestId("streak-tile")).toHaveCount(0);
  // La page reste accessible depuis le profil : le calcul a continué.
  await page.goto("/app/progress?from=profile");
  await expect(page.getByTestId("streak-current")).toContainText("3 semaines");

  await page.goto("/settings/profile");
  await page.getByText("Afficher la série et le passeport").click();
  await expect(page.getByLabel("Afficher la série et le passeport")).toBeChecked();
  await expect(page.getByText(/Enregistré/)).toBeVisible();
  await page.goto("/app");
  await expect(page.getByTestId("streak-tile")).toContainText("3 semaines");
});

test("carte de palier : l'image se génère, légère, sans prénom ni nom de foyer", async ({ page }) => {
  await signUp(page, "progres-share");
  const household = await householdId(page);
  await seedStreak(household, 4);
  await adminDb()
    .insertInto("achievements")
    .values({ household_id: household, kind: "streak", key: "4", seen_at: new Date().toISOString() })
    .onConflict((oc) =>
      oc.columns(["household_id", "kind", "key"]).doUpdateSet({ seen_at: new Date().toISOString() }),
    )
    .execute();

  const res = await page.request.get("/api/share/streak?milestone=4");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
  expect((await res.body()).length).toBeLessThan(300 * 1024);
  expect(res.url()).not.toMatch(/prenom|nom|name|household/i);
  // Un palier non atteint est refusé, un anonyme aussi.
  expect((await page.request.get("/api/share/streak?milestone=12")).status()).toBe(403);
  expect((await page.request.get("/api/share/streak?milestone=7")).status()).toBe(400);
});
