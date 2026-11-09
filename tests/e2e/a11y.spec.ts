import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { dbConfigured, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// M11 : accessibilité (WCAG 2.1 AA, contrastes compris) des écrans principaux, en clair et en sombre.
test.skip(({ isMobile }) => isMobile, "audit joué sur le projet desktop");

async function audit(page: Page, name: string) {
  // L'accueil diffère le rendu de ses sections basses (`content-visibility: auto`) : axe ne peut pas calculer les
  // couleurs d'un contenu non rendu et signalerait de faux contrastes. Tout est rendu avant l'audit ; la propriété ne
  // change ni l'arbre d'accessibilité ni les couleurs.
  await page.addStyleTag({ content: "* { content-visibility: visible !important; }" });
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = violations.map(
    (v) =>
      `${name} · ${v.id} (${v.impact}) : ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

test("pages publiques", async ({ page }) => {
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    await audit(page, path);
  }
});

test("écrans de l'application, en clair puis en sombre", async ({ page }) => {
  test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
  test.setTimeout(180_000);
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("a11y"));
  await completeOnboarding(page, "Accessible");
  const screens = [
    "/app",
    "/app/discover",
    "/app/shopping",
    "/app/stock",
    "/app/session",
    "/app/progress",
    "/app/print",
    "/app/discover/import",
    "/settings/profile",
    "/settings/canteen",
  ];
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of screens) {
      await page.goto(path);
      // Pas de « networkidle » : le flux temps réel (SSE, /api/realtime) reste ouvert sur les écrans du foyer.
      await page.waitForLoadState("load");
      await page.locator("main").first().waitFor();
      await audit(page, `${path} (${scheme})`);
    }
  }
});
