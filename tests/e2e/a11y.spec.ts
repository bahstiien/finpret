import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { signInFromLoginPage, supabaseConfigured, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// M11 : accessibilité (WCAG 2.1 AA, contrastes compris) des écrans principaux, en clair et en sombre.
test.skip(({ isMobile }) => isMobile, "audit joué sur le projet desktop");

async function audit(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = violations.map((v) => `${name} · ${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary).toEqual([]);
}

test("pages publiques", async ({ page }) => {
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    await audit(page, path);
  }
});

test("écrans de l'application, en clair puis en sombre", async ({ page }) => {
  test.skip(!supabaseConfigured, "Supabase n'est pas configuré (voir .env.example)");
  test.setTimeout(180_000);
  await page.goto("/login");
  await signInFromLoginPage(page, uniqueEmail("a11y"));
  await completeOnboarding(page, "Accessible");
  const screens = ["/app", "/app/discover", "/app/shopping", "/app/stock", "/app/session", "/app/print", "/app/discover/import", "/settings/profile", "/settings/canteen"];
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of screens) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await audit(page, `${path} (${scheme})`);
    }
  }
});
