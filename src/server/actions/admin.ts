"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { audit, requireOwner } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { sendAssociationApproved, sendAssociationRejected, sendStatement } from "@/server/emails";
import { readStoredFile } from "@/server/files";
import { stripeAvailable, stripeClient } from "@/server/stripe";
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
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  const a = await withAdmin((db) =>
    db
      .updateTable("associations")
      .set({ status: "approved", approved_at: new Date().toISOString(), reject_reason: null })
      .where("id", "=", id.data)
      .returning(["name", "code", "email"])
      .executeTakeFirst(),
  ).catch(() => undefined);
  if (!a) return fail();
  await audit(user.id, "association.approve", id.data, { name: a.name });
  await sendAssociationApproved(a.email, a.name, a.code).catch(() => null);
  return ok("/admin/associations");
}

export async function rejectAssociation(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  const reason = z.string().trim().min(3).max(300).safeParse(formData.get("reason"));
  if (!id.success || !reason.success)
    return { ok: false, error: "Indiquez un motif (3 caractères au moins)." };
  const a = await withAdmin((db) =>
    db
      .updateTable("associations")
      .set({ status: "rejected", reject_reason: reason.data })
      .where("id", "=", id.data)
      .returning(["name", "email"])
      .executeTakeFirst(),
  ).catch(() => undefined);
  if (!a) return fail();
  await audit(user.id, "association.reject", id.data, { reason: reason.data });
  await sendAssociationRejected(a.email, a.name, reason.data).catch(() => null);
  return ok("/admin/associations");
}

export async function setAssociationSuspended(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  const suspended = formData.get("suspended") === "1";
  if (!id.success) return fail();
  try {
    await withAdmin((db) =>
      db
        .updateTable("associations")
        .set({ status: suspended ? "suspended" : "approved" })
        .where("id", "=", id.data)
        .execute(),
    );
  } catch {
    return fail();
  }
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
  const { user } = await requireOwner();
  const uai = String(formData.get("uai") ?? "").trim();
  const parsed = schoolSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    ...(uai ? { uai } : {}),
  });
  if (!parsed.success) return fail();
  let data: { id: string };
  try {
    data = await withAdmin((db) =>
      db
        .insertInto("schools")
        .values({ ...parsed.data, uai: parsed.data.uai ?? null })
        .returning("id")
        .executeTakeFirstOrThrow(),
    );
  } catch (e) {
    const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;
    return { ok: false, error: code === "23505" ? "Ce code UAI existe déjà." : fr.errors.generic };
  }
  await audit(user.id, "school.create", data.id, parsed.data);
  return ok("/admin/ecoles");
}

export async function updateSchool(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  const uai = String(formData.get("uai") ?? "").trim();
  const parsed = schoolSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    ...(uai ? { uai } : {}),
  });
  if (!id.success || !parsed.success) return fail();
  try {
    await withAdmin((db) =>
      db
        .updateTable("schools")
        .set({ ...parsed.data, uai: parsed.data.uai ?? null })
        .where("id", "=", id.data)
        .execute(),
    );
  } catch {
    return fail();
  }
  await audit(user.id, "school.update", id.data, parsed.data);
  return ok("/admin/ecoles");
}

/** Dépublie un menu (retour en brouillon) : il disparaît du programme des familles. */
export async function unpublishMenu(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  try {
    await withAdmin((db) =>
      db.updateTable("school_menus").set({ status: "draft" }).where("id", "=", id.data).execute(),
    );
  } catch {
    return fail();
  }
  await audit(user.id, "menu.unpublish", id.data);
  return ok("/admin/menus");
}

// ---------------------------------------------------------------------------
// Reversements, prospects, support
// ---------------------------------------------------------------------------

/** « Marquer comme payé » : le versement passe à `paid` et le relevé PDF est envoyé au bureau. */
export async function markPayoutPaid(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  const payout = await withAdmin((db) =>
    db
      .selectFrom("payouts")
      .select(["id", "association_id", "quarter", "amount_cents", "status", "statement_path"])
      .where("id", "=", id.data)
      .executeTakeFirst(),
  );
  if (!payout || payout.status !== "ready") return { ok: false, error: "Ce versement n'est pas à verser." };
  try {
    await withAdmin((db) =>
      db
        .updateTable("payouts")
        .set({ status: "paid", paid_at: new Date().toISOString() })
        .where("id", "=", id.data)
        .execute(),
    );
  } catch {
    return fail();
  }
  await audit(user.id, "payout.paid", id.data, { quarter: payout.quarter, amount: payout.amount_cents });

  const a = await withAdmin((db) =>
    db
      .selectFrom("associations")
      .select(["name", "email"])
      .where("id", "=", payout.association_id)
      .executeTakeFirst(),
  );
  const pdf = payout.statement_path ? await readStoredFile("asso-statements", payout.statement_path) : null;
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
  await sendStatement(input, pdf, true).catch(() => null);
  return ok("/admin/reversements");
}

export async function markLeadContacted(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  try {
    await withAdmin((db) =>
      db
        .updateTable("association_leads")
        .set({ contacted_at: new Date().toISOString() })
        .where("id", "=", id.data)
        .execute(),
    );
  } catch {
    return fail();
  }
  await audit(user.id, "lead.contacted", id.data);
  return ok("/admin/prospects");
}

/** Support : prolonge l'essai d'un foyer de 14 jours (geste commercial). */
export async function extendTrial(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const householdId = uuid.safeParse(formData.get("householdId"));
  if (!householdId.success) return fail();
  const sub = await withAdmin((db) =>
    db
      .selectFrom("subscriptions")
      .select(["plan", "trial_ends_at"])
      .where("household_id", "=", householdId.data)
      .executeTakeFirst(),
  );
  if (!sub || (sub.plan !== "trial" && sub.plan !== "free"))
    return { ok: false, error: "Ce foyer est déjà abonné." };
  const from = Math.max(Date.now(), sub.trial_ends_at ? Date.parse(sub.trial_ends_at) : 0);
  const until = new Date(from + 14 * 86_400_000).toISOString();
  try {
    await withAdmin((db) =>
      db
        .updateTable("subscriptions")
        .set({
          plan: "trial",
          status: "trialing",
          trial_ends_at: until,
          updated_at: new Date().toISOString(),
        })
        .where("household_id", "=", householdId.data)
        .execute(),
    );
  } catch {
    return fail();
  }
  await audit(user.id, "support.extend_trial", householdId.data, { until });
  return ok("/admin/support");
}

// ---------------------------------------------------------------------------
// Codes promo (Stripe : coupon + code promotionnel, saisi sur la page de paiement)
// ---------------------------------------------------------------------------

const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, "Code de 3 à 30 caractères (lettres, chiffres, - et _)."),
  percent: z.coerce.number().int().min(1).max(100),
  duration: z.enum(["once", "repeating", "forever"]),
  months: z.coerce.number().int().min(1).max(36).optional(),
  maxRedemptions: z.coerce.number().int().min(1).max(100000).optional(),
  expires: z.iso.date().optional(),
  firstTime: z.boolean(),
  minEuros: z.coerce.number().positive().max(10000).optional(),
});

const blank = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : v);

export async function createPromoCode(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  if (!stripeAvailable()) return { ok: false, error: "Stripe n'est pas configuré sur ce serveur." };
  const parsed = promoSchema.safeParse({
    code: formData.get("code"),
    percent: formData.get("percent"),
    duration: formData.get("duration"),
    months: blank(formData.get("months")),
    maxRedemptions: blank(formData.get("maxRedemptions")),
    expires: blank(formData.get("expires")),
    firstTime: formData.get("firstTime") === "on",
    minEuros: blank(formData.get("minEuros")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? fr.errors.generic };
  const p = parsed.data;
  if (p.duration === "repeating" && !p.months) return { ok: false, error: "Indique le nombre de mois." };
  try {
    const stripe = stripeClient();
    const coupon = await stripe.coupons.create({
      name: p.code,
      percent_off: p.percent,
      duration: p.duration,
      ...(p.duration === "repeating" ? { duration_in_months: p.months } : {}),
    });
    await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code: p.code,
      ...(p.maxRedemptions ? { max_redemptions: p.maxRedemptions } : {}),
      ...(p.expires ? { expires_at: Math.floor(new Date(`${p.expires}T23:59:59Z`).getTime() / 1000) } : {}),
      ...(p.firstTime || p.minEuros
        ? {
            restrictions: {
              ...(p.firstTime ? { first_time_transaction: true } : {}),
              ...(p.minEuros ? { minimum_amount: Math.round(p.minEuros * 100), minimum_amount_currency: "eur" } : {}),
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("Code promo :", error instanceof Error ? error.message : error);
    return { ok: false, error: "Stripe a refusé la création (ce code existe peut-être déjà)." };
  }
  await audit(user.id, "promo.create", p.code, { percent: p.percent, duration: p.duration });
  return ok("/admin/codes-promo");
}

export async function setPromoActive(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = z
    .string()
    .regex(/^promo_[A-Za-z0-9]+$/)
    .safeParse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id.success || !stripeAvailable()) return fail();
  try {
    await stripeClient().promotionCodes.update(id.data, { active });
  } catch {
    return fail();
  }
  await audit(user.id, active ? "promo.enable" : "promo.disable", id.data);
  return ok("/admin/codes-promo");
}
