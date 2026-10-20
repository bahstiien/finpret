import "server-only";
import { sendEmail } from "@/server/email";

/** Alerte e-mail à l'équipe quand un webhook Stripe échoue (SPEC_JANVIER §8). Destinataire : ALERT_EMAIL. */
export async function alertWebhookFailure(eventId: string, type: string, error: unknown): Promise<void> {
  const to = process.env.ALERT_EMAIL;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`webhook Stripe en erreur (${type} ${eventId}) : ${message}`);
  if (!to) return;
  await sendEmail({
    to,
    subject: `[Fin Prêt] Webhook Stripe en erreur : ${type}`,
    text: `Événement ${eventId} (${type}) : ${message}\n\nStripe va le renvoyer ; vérifiez les journaux si l'erreur persiste.`,
    html: `<p>Événement <code>${eventId}</code> (<code>${type}</code>) :</p><pre>${message.replace(/[<>&]/g, "")}</pre><p>Stripe va le renvoyer ; vérifiez les journaux si l'erreur persiste.</p>`,
  }).catch(() => null);
}
