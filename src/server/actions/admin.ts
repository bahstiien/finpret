"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { audit, requireAdmin } from "@/server/admin";
import { sendAssociationApproved, sendAssociationRejected, sendStatement } from "@/server/emails";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/server/errors";
import type { StatementInput } from "@/server/payouts";

const ok = (path: string): ActionResult => {
  revalidatePath(path);
  return { ok: true, data: undefined };
};
const fail = (): ActionResult => ({ ok: false, error: fr.errors.generic });
const uuid = z.uuid();

// ---------------------------------------------------------------------------
// Associations
// ---------------------------------------------------------------------------

/** Valide une association : le code devient actif et le bureau en est informé. */
export async function approveAssociation(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  const { data: a, error } = await db
    .from("associations")
    .update({ status: "approved", approved_at: new Date().toISOString(), reject_reason: null })
    .eq("id", id.data)
    .select("name, code, email")
    .single();
  if (error || !a) return fail();
  await audit(user.id, "association.approve", id.data, { name: a.name });
  await sendAssociationApproved(a.email, a.name, a.code).catch(() => null);
  return ok("/admin/associations");
}

export async function rejectAssociation(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const reason = z.string().trim().min(3).max(300).safeParse(formData.get("reason"));
  if (!id.success || !reason.success)
    return { ok: false, error: "Indiquez un motif (3 caractères au moins)." };
  const { data: a, error } = await db
    .from("associations")
    .update({ status: "rejected", reject_reason: reason.data })
    .eq("id", id.data)
    .select("name, email")
    .single();
  if (error || !a) return fail();
  await audit(user.id, "association.reject", id.data, { reason: reason.data });
  await sendAssociationRejected(a.email, a.name, reason.data).catch(() => null);
  return ok("/admin/associations");
}

export async function setAssociationSuspended(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const suspended = formData.get("suspended") === "1";
  if (!id.success) return fail();
  const { error } = await db
    .from("associations")
    .update({ status: suspended ? "suspended" : "approved" })
    .eq("id", id.data);
  if (error) return fail();
  await audit(user.id, suspended ? "association.suspend" : "association.reactivate", id.data);
  return ok("/admin/associations");
}

// ---------------------------------------------------------------------------
// Écoles et menus
// ---------------------------------------------------------------------------

const schoolSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  uai: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{7}[A-Z]$/)
    .optional(),
});

export async function createSchool(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const uai = String(formData.get("uai") ?? "").trim();
  const parsed = schoolSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    ...(uai ? { uai } : {}),
  });
  if (!parsed.success) return fail();
  const { data, error } = await db
    .from("schools")
    .insert({ ...parsed.data, uai: parsed.data.uai ?? null })
    .select("id")
    .single();
  if (error || !data)
    return { ok: false, error: error?.code === "23505" ? "Ce code UAI existe déjà." : fr.errors.generic };
  await audit(user.id, "school.create", data.id, parsed.data);
  return ok("/admin/ecoles");
}

export async function updateSchool(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const uai = String(formData.get("uai") ?? "").trim();
  const parsed = schoolSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    ...(uai ? { uai } : {}),
  });
  if (!id.success || !parsed.success) return fail();
  const { error } = await db
    .from("schools")
    .update({ ...parsed.data, uai: parsed.data.uai ?? null })
    .eq("id", id.data);
  if (error) return fail();
  await audit(user.id, "school.update", id.data, parsed.data);
  return ok("/admin/ecoles");
}

/** Dépublie un menu (retour en brouillon) : il disparaît du programme des familles. */
export async function unpublishMenu(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  const { error } = await db.from("school_menus").update({ status: "draft" }).eq("id", id.data);
  if (error) return fail();
  await audit(user.id, "menu.unpublish", id.data);
  return ok("/admin/menus");
}

// ---------------------------------------------------------------------------
// Reversements, prospects, support
// ---------------------------------------------------------------------------

/** « Marquer comme payé » : le versement passe à `paid` et le relevé PDF est envoyé au bureau. */
export async function markPayoutPaid(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  const { data: payout } = await db
    .from("payouts")
    .select("id, association_id, quarter, amount_cents, status, statement_path")
    .eq("id", id.data)
    .maybeSingle();
  if (!payout || payout.status !== "ready") return { ok: false, error: "Ce versement n'est pas à verser." };
  const { error } = await db
    .from("payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) return fail();
  await audit(user.id, "payout.paid", id.data, { quarter: payout.quarter, amount: payout.amount_cents });

  const { data: a } = await db
    .from("associations")
    .select("name, email")
    .eq("id", payout.association_id)
    .maybeSingle();
  const pdf = payout.statement_path
    ? await createAdminClient().storage.from("asso-statements").download(payout.statement_path)
    : null;
  const input: StatementInput = {
    associationId: payout.association_id,
    associationName: a?.name ?? "",
    associationEmail: a?.email ?? "",
    quarter: payout.quarter,
    amountCents: payout.amount_cents,
    yearly: 0,
    monthly: 0,
    refunds: 0,
  };
  await sendStatement(input, pdf?.data ? Buffer.from(await pdf.data.arrayBuffer()) : null, true).catch(
    () => null,
  );
  return ok("/admin/reversements");
}

export async function markLeadContacted(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  const { error } = await db
    .from("association_leads")
    .update({ contacted_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) return fail();
  await audit(user.id, "lead.contacted", id.data);
  return ok("/admin/prospects");
}

/** Support : prolonge l'essai d'un foyer de 14 jours (geste commercial). */
export async function extendTrial(formData: FormData): Promise<ActionResult> {
  const { user, db } = await requireAdmin();
  const householdId = uuid.safeParse(formData.get("householdId"));
  if (!householdId.success) return fail();
  const { data: sub } = await db
    .from("subscriptions")
    .select("plan, trial_ends_at")
    .eq("household_id", householdId.data)
    .maybeSingle();
  if (!sub || (sub.plan !== "trial" && sub.plan !== "free"))
    return { ok: false, error: "Ce foyer est déjà abonné." };
  const from = Math.max(Date.now(), sub.trial_ends_at ? Date.parse(sub.trial_ends_at) : 0);
  const until = new Date(from + 14 * 86_400_000).toISOString();
  const { error } = await db
    .from("subscriptions")
    .update({ plan: "trial", status: "trialing", trial_ends_at: until, updated_at: new Date().toISOString() })
    .eq("household_id", householdId.data);
  if (error) return fail();
  await audit(user.id, "support.extend_trial", householdId.data, { until });
  return ok("/admin/support");
}
