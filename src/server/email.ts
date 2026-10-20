import "server-only";

export type Email = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
  /** Lien de désinscription en un clic : obligatoire sur tout e-mail non transactionnel (SPEC_JANVIER §8). */
  unsubscribeUrl?: string;
};

export type SendResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

/** Envoi par Resend. Sans RESEND_API_KEY, l'e-mail n'est pas envoyé (développement, tests). */
export async function sendEmail(email: Email, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, reason: "not_configured" };
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.attachments?.map((a) => ({
        filename: a.filename,
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
