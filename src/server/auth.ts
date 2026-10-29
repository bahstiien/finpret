import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import pg from "pg";
import { FEATURES } from "@/lib/features";
import { sendMagicLink } from "@/server/emails";
import { trackEvent } from "@/server/events";

/**
 * Better Auth (remplace Supabase Auth) : lien magique par e-mail, Google, et Apple derrière son drapeau.
 * Tables du schéma `auth` (migration 20261107000000_better_auth.sql), lues et écrites en `service_role`.
 * Le second facteur du back-office est géré à part (src/server/mfa.ts).
 */

function authPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manque (voir .env.example).");
  const pool = new pg.Pool({ connectionString, max: 5 });
  pool.on("connect", (client) => void client.query("set role service_role; set search_path = auth, extensions"));
  return pool;
}

const timestamps = { createdAt: "created_at", updatedAt: "updated_at" };

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
      fields: { userId: "user_id", expiresAt: "expires_at", ipAddress: "ip_address", userAgent: "user_agent", ...timestamps },
      additionalFields: { mfaVerifiedAt: { type: "date", required: false, input: false, fieldName: "mfa_verified_at" } },
      // Durée et renouvellement proches de Supabase : 30 jours glissants.
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
    advanced: { database: { generateId: "uuid" } },
    socialProviders: { ...google, ...apple },
    databaseHooks: {
      user: { create: { after: async (user) => void (await trackEvent("signup", { userId: user.id })) } },
    },
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          const sent = await sendMagicLink(email, url);
          // Sans Resend en développement, le lien s'affiche dans le terminal de `pnpm dev`.
          if (!sent.ok && sent.reason === "not_configured" && process.env.NODE_ENV !== "production")
            console.info(`[auth] lien de connexion pour ${email} : ${url}`);
          else if (!sent.ok) throw new Error("Envoi du lien de connexion impossible.");
        },
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
