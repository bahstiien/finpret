"use server";

import { fr } from "@/i18n/fr";
import { contactSchema } from "@/lib/contact";
import { CONTACT_EMAIL } from "@/lib/tuto";
import { withAdmin } from "@/server/db";
import { sendContactMessage } from "@/server/emails";
import { allow, clientIp } from "@/server/rate-limit";

export type ContactState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; name: string; email: string; subject: string; message: string };

/**
 * Formulaire de contact : le message est enregistré pour le back-office (/admin/demandes) et part par e-mail à
 * l'équipe, qui répond directement à la personne. Une fois enregistré, un échec d'envoi ne perd plus le message.
 */
export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: fr.contact.invalid };
  const v = parsed.data;

  // 5 messages par heure et par adresse IP, 3 par adresse e-mail.
  if (!allow(`contact-ip:${await clientIp()}`, 5, 3_600_000) || !allow(`contact:${v.email}`, 3, 3_600_000))
    return { status: "error", message: fr.contact.tooMany };

  const details =
    v.audience === "asso"
      ? [v.association && `Association : ${v.association}`, v.school && `École : ${v.school}`].filter(
          (line): line is string => Boolean(line),
        )
      : [];
  const stored = await withAdmin((db) =>
    db
      .insertInto("contact_messages")
      .values({
        audience: v.audience,
        name: v.name,
        email: v.email,
        subject: v.subject,
        message: v.message,
        association: v.audience === "asso" ? v.association || null : null,
        school: v.audience === "asso" ? v.school || null : null,
      })
      .execute(),
  ).then(
    () => true,
    (error: unknown) => {
      console.error("[contact] enregistrement impossible", error);
      return false;
    },
  );
  const sent = await sendContactMessage(process.env.CONTACT_EMAIL ?? CONTACT_EMAIL, {
    name: v.name,
    email: v.email,
    audience: v.audience === "asso" ? fr.contact.asso : fr.contact.family,
    subject: v.subject,
    message: v.message,
    details,
  });
  // Sans Brevo en développement, le message s'affiche dans le terminal de `pnpm dev`.
  if (!sent.ok && sent.reason === "not_configured" && process.env.NODE_ENV !== "production")
    console.info(`[contact] ${v.name} <${v.email}> · ${v.subject}\n${v.message}`);
  else if (!sent.ok && !stored) return { status: "error", message: fr.contact.failed };

  return { status: "sent", name: v.name, email: v.email, subject: v.subject, message: v.message };
}
