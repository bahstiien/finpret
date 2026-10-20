"use server";

import { z } from "zod";
import { associationsFr } from "@/i18n/associations";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/server/email";
import { trackEvent } from "@/server/events";
import { renderPresentationPdf } from "@/server/pdf/presentation-pdf";
import { allow, clientIp } from "@/server/rate-limit";

const t = associationsFr.lead;

const PUBLIC_EVENTS = ["asso_landing_view", "asso_simulator_used", "asso_signup_started"] as const;

/** Événements de la landing, sans cookie ni traceur tiers : un nom, rien d'autre. 60 par minute et par adresse. */
export async function recordPublicEvent(name: string): Promise<void> {
  if (!(PUBLIC_EVENTS as readonly string[]).includes(name)) return;
  if (!allow(`public-event:${await clientIp()}`, 60, 60_000)) return;
  await trackEvent(name as (typeof PUBLIC_EVENTS)[number]);
}

export type LeadState = { error?: string; ok?: boolean };

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  association: z.string().trim().min(2).max(160),
  school: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  families: z.coerce.number().int().min(0).max(100_000).optional(),
  consent: z.literal("on"),
});

/**
 * Demande de présentation : enregistrée dans `association_leads`, fiche PDF envoyée par e-mail, équipe prévenue.
 * Anti-spam sans captcha tiers : champ piège invisible (`website`) et 3 envois par heure et par adresse IP.
 */
export async function submitLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  // Un robot remplit le champ piège : on répond « envoyé » sans rien faire.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };
  if (!allow(`lead:${await clientIp()}`, 3, 3_600_000)) return { error: t.errors.tooMany };
  const raw = Object.fromEntries(formData);
  const parsed = leadSchema.safeParse({
    ...raw,
    families: String(raw.families ?? "").trim() === "" ? undefined : raw.families,
    school: String(raw.school ?? "").trim() || undefined,
    city: String(raw.city ?? "").trim() || undefined,
  });
  if (!parsed.success) return { error: t.errors.invalid };
  const l = parsed.data;
  const { error } = await createAdminClient()
    .from("association_leads")
    .insert({
      name: l.name,
      email: l.email,
      association_name: l.association,
      school: l.school ?? null,
      city: l.city ?? null,
      families_estimate: l.families ?? null,
      consent: true,
    });
  if (error) return { error: t.errors.generic };
  await trackEvent("asso_lead_submitted");

  const pdf = await renderPresentationPdf().catch(() => null);
  const escape = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  await sendEmail({
    to: l.email,
    subject: "Fin Prêt : la présentation pour votre association",
    text: `Bonjour ${l.name},\n\nVoici la fiche de présentation de Fin Prêt pour ${l.association}, en pièce jointe. Pour créer le compte de votre association : https://finpret.app/asso/inscription\n\nL'équipe Fin Prêt · bonjour@finpret.app`,
    html: `<p>Bonjour ${escape(l.name)},</p><p>Voici la fiche de présentation de Fin Prêt pour ${escape(l.association)}, en pièce jointe.</p><p><a href="https://finpret.app/asso/inscription">Créer le compte de votre association</a></p><p>L'équipe Fin Prêt · bonjour@finpret.app</p>`,
    attachments: pdf ? [{ filename: "fin-pret-presentation.pdf", content: pdf }] : undefined,
  }).catch(() => null);
  const admin = process.env.ALERT_EMAIL;
  if (admin) {
    await sendEmail({
      to: admin,
      subject: `[Fin Prêt] Nouveau prospect : ${l.association}`,
      text: `${l.name} <${l.email}> · ${l.association} · ${l.school ?? ""} ${l.city ?? ""} · ~${l.families ?? "?"} familles`,
      html: `<p>${escape(l.name)} &lt;${escape(l.email)}&gt; · ${escape(l.association)}</p>`,
    }).catch(() => null);
  }
  return { ok: true };
}
