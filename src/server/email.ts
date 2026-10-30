import "server-only";

export type Email = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
  /** Lien de désinscription en un clic : obligatoire sur tout e-mail non transactionnel (SPEC_JANVIER §8). */
  unsubscribeUrl?: string;
  /** Adresse de réponse (formulaire de contact : l'équipe répond à la personne). */
  replyTo?: string;
};

export type SendResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

/** « Fin Prêt <rappels@finpret.app> » ou « rappels@finpret.app » → expéditeur au format Brevo. */
export function parseSender(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!m) return { email: from.trim() };
  const name = m[1]!.replace(/^"|"$/g, "");
  return name ? { name, email: m[2]!.trim() } : { email: m[2]!.trim() };
}

/** Envoi par Brevo (API transactionnelle). Sans BREVO_API_KEY, l'e-mail n'est pas envoyé (développement, tests). */
export async function sendEmail(email: Email, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, reason: "not_configured" };
  const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseSender(from),
      to: (Array.isArray(email.to) ? email.to : [email.to]).map((address) => ({ email: address })),
      subject: email.subject,
      replyTo: email.replyTo ? { email: email.replyTo } : undefined,
      htmlContent: email.html,
      textContent: email.text,
      attachment: email.attachments?.map((a) => ({
        name: a.filename,
        content: a.content.toString("base64"),
      })),
      headers: email.unsubscribeUrl
        ? {
            "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    }),
  }).catch(() => null);
  return res?.ok ? { ok: true } : { ok: false, reason: "failed" };
}
