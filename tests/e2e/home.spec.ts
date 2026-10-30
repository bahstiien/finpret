import { expect, test } from "@playwright/test";
import { FEATURES } from "../../src/lib/features";

test("la page d'accueil s'affiche en français", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^Fin Prêt/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("2 h 30 le dimanche.");
  // « Connexion » n'apparaît qu'à partir de 900 px ; sur mobile, « Commencer » mène aussi à /login.
  await expect(page.getByRole("banner").locator('a[href="/login"]:visible').first()).toBeVisible();
});

test("aucun défilement horizontal", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("le manifest PWA est servi", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ lang: "fr", display: "standalone", short_name: "Fin Prêt" });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([expect.objectContaining({ sizes: "512x512", purpose: "maskable" })]),
  );
  // Cible de partage de l'import de recettes : seulement quand la fonction (REPORTÉE) est activée.
  if (FEATURES.recipeImport) expect(manifest.share_target.action).toBe("/app/discover/import");
  else expect(manifest.share_target).toBeUndefined();
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test("le service worker s'enregistre", async ({ page }) => {
  await page.goto("/");
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
  expect(scope).toMatch(/\/$/);
});
