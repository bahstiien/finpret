import { expect, type Page } from "@playwright/test";

/** Boîte de réception locale de Supabase (Mailpit). */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSearch = { messages: { ID: string; Created: string }[] };

/** Attend le dernier e-mail reçu par `email` et renvoie le lien de connexion qu'il contient. */
export async function waitForMagicLink(page: Page, email: string, since: number): Promise<string> {
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

/** Connexion complète par lien magique, depuis la page de connexion déjà ouverte. */
export async function signInFromLoginPage(page: Page, email: string) {
  const since = Date.now();
  await page.getByLabel("Ton adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  await page.goto(await waitForMagicLink(page, email, since));
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
