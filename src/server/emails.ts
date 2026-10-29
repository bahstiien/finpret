import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { render } from "@react-email/render";
import { createElement } from "react";
import {
  AssociationApprovedEmail,
  AssociationReceivedEmail,
  AssociationRejectedEmail,
  HouseholdInvitationEmail,
  MagicLinkEmail,
  PaymentFailedEmail,
  StatementEmail,
  TrialEndingEmail,
  WelcomeEmail,
} from "@/emails/templates";
import { type Email, sendEmail, type SendResult } from "@/server/email";
import type { StatementInput } from "@/server/payouts";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Jeton de désinscription : HMAC du compte, vérifiable sans stockage. */
export function unsubscribeToken(
  userId: string,
  secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? "",
): string {
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string, secret?: string): boolean {
  const expected = unsubscribeToken(userId, secret);
  return token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export const unsubscribeUrl = (userId: string) =>
  `${appUrl()}/api/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;

async function build(
  to: string,
  subject: string,
  element: React.ReactElement,
  extra: Partial<Email> = {},
): Promise<Email> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { to, subject, html, text, ...extra };
}

/** Lien magique de connexion (Better Auth), anciennement envoyé par Supabase. */
export async function sendMagicLink(to: string, url: string): Promise<SendResult> {
  return sendEmail(await build(to, "Ton lien de connexion à Fin Prêt", createElement(MagicLinkEmail, { url })));
}

export async function sendHouseholdInvitation(
  to: string,
  householdName: string,
  token: string,
): Promise<SendResult> {
  const url = `${appUrl()}/join/${token}`;
  return sendEmail(
    await build(
      to,
      `Rejoins « ${householdName} » sur Fin Prêt`,
      createElement(HouseholdInvitationEmail, { householdName, url }),
    ),
  );
}

export async function sendWelcome(to: string, userId: string, name: string): Promise<SendResult> {
  const unsub = unsubscribeUrl(userId);
  return sendEmail(
    await build(
      to,
      "Bienvenue sur Fin Prêt",
      createElement(WelcomeEmail, { name, url: `${appUrl()}/app`, unsubscribeUrl: unsub }),
      {
        unsubscribeUrl: unsub,
      },
    ),
  );
}

export async function sendTrialEnding(to: string, userId: string, days: number): Promise<SendResult> {
  const unsub = unsubscribeUrl(userId);
  return sendEmail(
    await build(
      to,
      days === 0
        ? "Ton essai Fin Prêt se termine aujourd'hui"
        : `Ton essai Fin Prêt se termine dans ${days} jours`,
      createElement(TrialEndingEmail, { days, url: `${appUrl()}/app/abonnement`, unsubscribeUrl: unsub }),
      { unsubscribeUrl: unsub },
    ),
  );
}

export async function sendPaymentFailed(to: string): Promise<SendResult> {
  return sendEmail(
    await build(
      to,
      "Ton paiement Fin Prêt n'a pas abouti",
      createElement(PaymentFailedEmail, { url: `${appUrl()}/app/abonnement` }),
    ),
  );
}

export async function sendAssociationReceived(to: string, name: string): Promise<SendResult> {
  return sendEmail(
    await build(
      to,
      "Demande reçue : Fin Prêt pour votre association",
      createElement(AssociationReceivedEmail, { name }),
    ),
  );
}

export async function sendAssociationApproved(to: string, name: string, code: string): Promise<SendResult> {
  return sendEmail(
    await build(
      to,
      `${name} est validée sur Fin Prêt`,
      createElement(AssociationApprovedEmail, { name, code, url: `${appUrl()}/asso` }),
    ),
  );
}

export async function sendAssociationRejected(to: string, name: string, reason: string): Promise<SendResult> {
  return sendEmail(
    await build(
      to,
      "Votre demande Fin Prêt n'a pas pu être validée",
      createElement(AssociationRejectedEmail, { name, reason }),
    ),
  );
}

/** Relevé trimestriel : e-mail au bureau avec le PDF en pièce jointe (versement prêt ou payé). */
export async function sendStatement(
  input: StatementInput,
  pdf: Buffer | null,
  paid = false,
): Promise<SendResult> {
  if (!input.associationEmail) return { ok: false, reason: "failed" };
  return sendEmail(
    await build(
      input.associationEmail,
      `Relevé Fin Prêt ${input.quarter}`,
      createElement(StatementEmail, {
        name: input.associationName,
        quarter: input.quarter,
        amount: euros(input.amountCents),
        paid,
      }),
      pdf ? { attachments: [{ filename: `releve-${input.quarter}.pdf`, content: pdf }] } : {},
    ),
  );
}
