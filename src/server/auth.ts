import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import pg from "pg";
import { FEATURES } from "@/lib/features";
import { sendMagicLink, sendPasswordReset, sendVerificationEmail } from "@/server/emails";
import { withAdmin } from "@/server/db";
import { trackEvent } from "@/server/events";

/**
 * Better Auth : e-mail et mot de passe, lien magique par e-mail, Google, et Apple derrière son drapeau.
 * Tables du schéma `auth` (migration 20261107000000_better_auth.sql), lues et écrites en `service_role`.
 * Le second facteur du back-office est géré à part (src/server/mfa.ts).
 */

function authPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manque (voir .env.example).");
  const pool = new pg.Pool({ connectionString, max: 5 });
  pool.on(
    "connect",
    (client) => void client.query("set role service_role; set search_path = auth, extensions"),
  );
  return pool;
}

const timestamps = { createdAt: "created_at", updatedAt: "updated_at" };

/** Tests de bout en bout lancés par Playwright : jamais sur un site public, l'application doit tourner sur localhost. */
const isLocalE2E = () =>
  Boolean(process.env.E2E_MAGIC_LINK_DIR) && /^http:\/\/localhost[:/]/.test(process.env.APP_URL ?? "");

/**
 * Dépose le lien dans un fichier lu par Playwright (tests de bout en bout, build de production local) au lieu de
 * l'envoyer ; renvoie false hors de ce cas.
 */
async function dropE2ELink(email: string, url: string): Promise<boolean> {
  const e2eDir = process.env.E2E_MAGIC_LINK_DIR;
  if (!e2eDir || !isLocalE2E()) return false;
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(e2eDir, { recursive: true });
  await writeFile(`${e2eDir}/${encodeURIComponent(email)}.txt`, url);
  return true;
}

/** Envoie un lien par e-mail ; sans Brevo en développement, il s'affiche dans le terminal de `pnpm dev`. */
async function deliverLink(
  kind: string,
  email: string,
  url: string,
  send: (to: string, url: string) => Promise<{ ok: true } | { ok: false; reason: string }>,
) {
  if (await dropE2ELink(email, url)) return;
  const sent = await send(email, url);
  if (!sent.ok && sent.reason === "not_configured" && process.env.NODE_ENV !== "production")
    console.info(`[auth] ${kind} pour ${email} : ${url}`);
  else if (!sent.ok) throw new Error("Envoi de l'e-mail impossible.");
}

function createAuth() {
  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {};
  const apple =
    FEATURES.appleSignIn && process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? { apple: { clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: "Fin Prêt",
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
    database: authPool(),
    user: {
      modelName: "users",
      fields: { emailVerified: "email_verified", ...timestamps },
    },
    session: {
      modelName: "sessions",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        ...timestamps,
      },
      additionalFields: {
        mfaVerifiedAt: { type: "date", required: false, input: false, fieldName: "mfa_verified_at" },
      },
      // Sessions de 30 jours glissants, renouvelées une fois par jour.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    account: {
      modelName: "accounts",
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        ...timestamps,
      },
      // Un compte Google et un lien magique de même adresse vérifiée désignent la même personne.
      accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
    },
    verification: {
      modelName: "verifications",
      fields: { expiresAt: "expires_at", ...timestamps },
    },
    advanced: {
      database: { generateId: "uuid" },
      // Derrière Caddy (deploy/Caddyfile), l'adresse du client est dans X-Forwarded-For : sans cela, tous les
      // visiteurs partageraient la même limite de requêtes.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    // Limiteur de Better Auth (actif en production), sauf pour les tests de bout en bout en local qui se
    // connectent en parallèle depuis la même adresse. La limite par e-mail de signInWithEmail reste active.
    rateLimit: { enabled: process.env.NODE_ENV === "production" && !isLocalE2E() },
    // Mot de passe : 8 caractères au moins. Un compte ne se connecte qu'après avoir confirmé son adresse (sinon
    // quelqu'un pourrait créer un compte sur l'adresse d'un autre et le retrouver lié à son compte Google).
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => deliverLink("réinitialisation", user.email, url, sendPasswordReset),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => deliverLink("confirmation", user.email, url, sendVerificationEmail),
    },
    socialProviders: { ...google, ...apple },
    databaseHooks: {
      // Compte suspendu depuis le back-office : aucune nouvelle session (les sessions ouvertes sont supprimées à la suspension).
      session: {
        create: {
          before: async (session) => {
            const banned = await withAdmin((db) =>
              db.selectFrom("auth.users").select("banned_at").where("id", "=", session.userId).executeTakeFirst(),
            );
            return banned?.banned_at ? false : { data: session };
          },
        },
      },
      user: { create: { after: async (user) => void (await trackEvent("signup", { userId: user.id })) } },
    },
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => deliverLink("lien de connexion", email, url, sendMagicLink),
      }),
      // Toujours en dernier : pose les cookies de session depuis les actions serveur.
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

/** Instance unique par processus, créée au premier usage (le build n'a pas besoin de DATABASE_URL). */
export function auth(): Auth {
  const globals = globalThis as { __finpretAuth?: Auth };
  globals.__finpretAuth ??= createAuth();
  return globals.__finpretAuth;
}
