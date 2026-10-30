import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "../../../src/server/db.types";

/** Domaine et préfixe des comptes de test : le nettoyage ne touche qu'à eux. */
export const TEST_EMAIL_PREFIX = "e2e-";
export const TEST_EMAIL_DOMAIN = "@example.com";

export const dbConfigured = Boolean(process.env.DATABASE_URL);

/** Dossier où l'application dépose les liens magiques en test (voir playwright.config.ts). */
export const MAGIC_LINK_DIR = path.resolve("test-results/magic-links");

/** Mêmes formats que le pool de l'application : dates en texte, horodatages ISO, numériques en nombres. */
const PG = pg.types.builtins;
function typeParser(oid: number, format?: string) {
  switch (oid) {
    case PG.DATE:
      return (v: string) => v;
    case PG.TIMESTAMPTZ:
    case PG.TIMESTAMP:
      // Comme src/server/db.ts (pgTimestamp) : format PostgREST, microsecondes conservées.
      return (v: string) => v.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
    case PG.NUMERIC:
    case PG.INT8:
      return (v: string) => Number(v);
    default:
      return pg.types.getTypeParser(oid, format as "text");
  }
}

let db: Kysely<DB> | undefined;

/**
 * Accès direct à la base, sous le rôle de la connexion (superutilisateur en local) : la RLS ne s'applique pas,
 * comme avec l'ancienne clé de service.
 */
export function adminDb(): Kysely<DB> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manque dans .env.local");
  db ??= new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString,
        max: 3,
        allowExitOnIdle: true,
        types: { getTypeParser: typeParser },
      }),
    }),
  });
  return db;
}

export async function closeAdminDb() {
  await db?.destroy();
  db = undefined;
}

export function uniqueEmail(name: string) {
  return `${TEST_EMAIL_PREFIX}${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}${TEST_EMAIL_DOMAIN}`;
}

/** Identifiant du compte (auth.users) de cette adresse. */
export async function userIdOf(email: string): Promise<string> {
  const row = await adminDb()
    .selectFrom("auth.users")
    .select("id")
    .where("email", "=", email)
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Compte créé directement en base, sans passer par la connexion. */
export async function createUser(email: string): Promise<string> {
  const row = await adminDb()
    .insertInto("auth.users")
    .values({ email, email_verified: true })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Foyer du compte (son unique adhésion). */
export async function householdIdOf(email: string): Promise<string> {
  const userId = await userIdOf(email);
  const row = await adminDb()
    .selectFrom("memberships")
    .select("household_id")
    .where("user_id", "=", userId)
    .executeTakeFirstOrThrow();
  return row.household_id;
}

/** Connexion complète par lien magique, depuis la page de connexion déjà ouverte. */
export async function signInFromLoginPage(page: Page, email: string) {
  // Attendre la page de connexion : le formulaire renvoie ensuite vers son paramètre `next`.
  await page.waitForURL((url) => url.pathname === "/login");
  const since = Date.now();
  await submitLoginForm(page, email);
  await page.goto(await waitForMagicLink(email, since));
}

export async function submitLoginForm(page: Page, email: string) {
  await page.getByLabel("Ton adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(page.getByRole("status")).toContainText(email);
}

/** Lien déposé par l'application dans MAGIC_LINK_DIR (au lieu de l'e-mail), plus récent que `since`. */
async function waitForMagicLink(email: string, since: number): Promise<string> {
  const file = path.join(MAGIC_LINK_DIR, `${encodeURIComponent(email)}.txt`);
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const info = await stat(file).catch(() => undefined);
        if (!info || info.mtimeMs < since - 1000) return undefined;
        link = (await readFile(file, "utf8")).trim() || undefined;
        return link;
      },
      { timeout: 15_000, message: `aucun lien de connexion reçu pour ${email}` },
    )
    .toBeTruthy();
  return link!;
}
