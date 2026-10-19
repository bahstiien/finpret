import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
/** Boîte de réception de Supabase local (Mailpit), utilisée en CI. */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Domaine et préfixe des comptes de test : le nettoyage ne touche qu'à eux. */
export const TEST_EMAIL_PREFIX = "e2e-";
export const TEST_EMAIL_DOMAIN = "@example.com";

export const supabaseConfigured = Boolean(SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Supabase local : vrai e-mail lu dans Mailpit.
 * Projet hébergé : lien généré par l'API d'administration (l'envoi d'e-mails y est limité à quelques-uns par heure).
 */
const mode: "mailpit" | "admin" = /127\.0\.0\.1|localhost/.test(SUPABASE_URL) ? "mailpit" : "admin";

export function adminClient() {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY manque dans .env.local");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function uniqueEmail(name: string) {
  return `${TEST_EMAIL_PREFIX}${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}${TEST_EMAIL_DOMAIN}`;
}

/** Connexion complète par lien magique, depuis la page de connexion déjà ouverte. */
export async function signInFromLoginPage(page: Page, email: string) {
  // Attendre la page de connexion : son paramètre `next` dit où revenir.
  await page.waitForURL((url) => url.pathname === "/login");
  const next = new URL(page.url()).searchParams.get("next") ?? "/app";
  if (mode === "mailpit") {
    const since = Date.now();
    await submitLoginForm(page, email);
    await page.goto(await waitForMailpitLink(page, email, since));
    return;
  }
  const admin = adminClient();
  const { error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (createError && !/already/i.test(createError.message)) throw createError;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "magiclink", next });
  await page.goto(`/auth/callback?${params}`);
}

export async function submitLoginForm(page: Page, email: string) {
  await page.getByLabel("Ton adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(page.getByRole("status")).toContainText(email);
}

export const canSendLoginEmail = mode === "mailpit";

type MailpitSearch = { messages: { ID: string; Created: string }[] };

async function waitForMailpitLink(page: Page, email: string, since: number): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await page.request.get(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        );
        if (!res.ok()) return undefined;
        const { messages } = (await res.json()) as MailpitSearch;
        const latest = messages.find((m) => Date.parse(m.Created) >= since - 1000);
        if (!latest) return undefined;
        const message = await (await page.request.get(`${MAILPIT}/api/v1/message/${latest.ID}`)).json();
        const html = String(message.HTML ?? "") + String(message.Text ?? "");
        link = html.match(/https?:\/\/[^"'\s<>]+\/auth\/v1\/verify[^"'\s<>]+/)?.[0]?.replaceAll("&amp;", "&");
        return link;
      },
      { timeout: 15_000, message: `aucun lien de connexion reçu pour ${email}` },
    )
    .toBeTruthy();
  return link!;
}
