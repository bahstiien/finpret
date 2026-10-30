import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { cronSecret } from "./tests/e2e/helpers/cron";

// Mêmes variables que l'application (DATABASE_URL de la base Postgres locale, secrets Better Auth).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3300;

// Liens magiques déposés par l'application au lieu d'être envoyés (lus par helpers/auth.ts).
// Vidé au démarrage par le processus principal seulement : les workers rechargent aussi ce fichier.
const MAGIC_LINK_DIR = path.resolve("test-results/magic-links");
if (!process.env.TEST_WORKER_INDEX) rmSync(MAGIC_LINK_DIR, { recursive: true, force: true });

export default defineConfig({
  testDir: "tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // Build de production : le service worker n'est actif qu'en production.
  webServer: {
    command: process.env.CI ? `pnpm start -p ${PORT}` : `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Import de recettes : pages de test servies sans réseau sous https://recettes.test/<nom> (§8.8).
    env: {
      IMPORT_FIXTURES_DIR: path.resolve("tests/fixtures/import"),
      // Planificateur des notifications (§12) appelé par les tests.
      CRON_SECRET: cronSecret(),
      // Connexion : liens magiques écrits dans ce dossier (seulement si APP_URL est en localhost).
      E2E_MAGIC_LINK_DIR: MAGIC_LINK_DIR,
      APP_URL: `http://localhost:${PORT}`,
    },
  },
});
