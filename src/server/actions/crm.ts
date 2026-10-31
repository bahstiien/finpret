"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { audit, requireOwner } from "@/server/admin";
import { auth } from "@/server/auth";
import { withAdmin } from "@/server/db";
import type { ActionResult } from "@/server/errors";
import { stripeAvailable, stripeClient } from "@/server/stripe";

const uuid = z.uuid();
const fail = (error: string = fr.errors.generic): ActionResult => ({ ok: false, error });
const ok = (path: string): ActionResult => {
  revalidatePath(path);
  return { ok: true, data: undefined };
};

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

/** Note de suivi interne sur un compte. */
export async function addAccountNote(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("userId"));
  const body = z.string().trim().min(1).max(2000).safeParse(formData.get("body"));
  if (!id.success || !body.success) return fail("Écris une note (2000 caractères au plus).");
  await withAdmin((db) =>
    db.insertInto("admin_notes").values({ user_id: id.data, admin_id: user.id, body: body.data }).execute(),
  );
  await audit(user.id, "account.note", id.data);
  return ok(`/admin/comptes/${id.data}`);
}

/** Suspend ou réactive un compte : les sessions ouvertes sont supprimées, aucune nouvelle ne peut être créée. */
export async function setAccountSuspended(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("userId"));
  const suspend = formData.get("suspend") === "true";
  const reason = z.string().trim().max(300).safeParse(formData.get("reason") ?? "");
  if (!id.success || !reason.success) return fail();
  if (id.data === user.id) return fail("Tu ne peux pas suspendre ton propre compte.");
  const isAdmin = await withAdmin((db) =>
    db.selectFrom("admins").select("user_id").where("user_id", "=", id.data).executeTakeFirst(),
  );
  if (isAdmin && suspend) return fail("Retire d'abord les droits d'administrateur de ce compte.");
  await withAdmin(async (db) => {
    await db
      .updateTable("auth.users")
      .set({
        banned_at: suspend ? new Date().toISOString() : null,
        ban_reason: suspend ? reason.data || null : null,
      })
      .where("id", "=", id.data)
      .execute();
    if (suspend) await db.deleteFrom("auth.sessions").where("user_id", "=", id.data).execute();
  });
  await audit(user.id, suspend ? "account.suspend" : "account.unsuspend", id.data, { reason: reason.data });
  return ok(`/admin/comptes/${id.data}`);
}

/** Envoie un lien de connexion à l'adresse du compte (aide à un utilisateur bloqué). */
export async function sendAccountLoginLink(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("userId"));
  if (!id.success) return fail();
  const target = await withAdmin((db) =>
    db.selectFrom("auth.users").select(["email", "banned_at"]).where("id", "=", id.data).executeTakeFirst(),
  );
  if (!target?.email) return fail();
  if (target.banned_at) return fail("Ce compte est suspendu.");
  try {
    await auth().api.signInMagicLink({ body: { email: target.email }, headers: await headers() });
  } catch {
    return fail("Envoi impossible.");
  }
  await audit(user.id, "account.login_link", id.data);
  return ok(`/admin/comptes/${id.data}`);
}

/**
 * Suppression définitive (RGPD) : abonnement Stripe résilié, foyers dont le compte est le seul membre supprimés,
 * puis compte supprimé (profil, appartenances, sessions et notes suivent en cascade). Confirmation par l'e-mail.
 */
export async function deleteAccount(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("userId"));
  if (!id.success) return fail();
  if (id.data === user.id) return fail("Tu ne peux pas supprimer ton propre compte.");
  const target = await withAdmin((db) =>
    db.selectFrom("auth.users").select("email").where("id", "=", id.data).executeTakeFirst(),
  );
  if (!target) return fail();
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== (target.email ?? "").toLowerCase())
    return fail("Saisis l'adresse e-mail du compte pour confirmer.");
  const isAdmin = await withAdmin((db) =>
    db.selectFrom("admins").select("user_id").where("user_id", "=", id.data).executeTakeFirst(),
  );
  if (isAdmin) return fail("Retire d'abord les droits d'administrateur de ce compte.");

  const soleHouseholds = await withAdmin(async (db) => {
    const mine = await db.selectFrom("memberships").select("household_id").where("user_id", "=", id.data).execute();
    const sole: string[] = [];
    for (const m of mine) {
      const others = await db
        .selectFrom("memberships")
        .select("user_id")
        .where("household_id", "=", m.household_id)
        .where("user_id", "!=", id.data)
        .executeTakeFirst();
      if (!others) sole.push(m.household_id);
    }
    return sole;
  });
  if (soleHouseholds.length && stripeAvailable()) {
    const subs = await withAdmin((db) =>
      db
        .selectFrom("subscriptions")
        .select("stripe_subscription_id")
        .where("household_id", "in", soleHouseholds)
        .where("stripe_subscription_id", "is not", null)
        .execute(),
    );
    for (const s of subs) {
      try {
        await stripeClient().subscriptions.cancel(s.stripe_subscription_id!);
      } catch {
        // Déjà résilié côté Stripe : on continue.
      }
    }
  }
  try {
    await withAdmin(async (db) => {
      if (soleHouseholds.length) await db.deleteFrom("households").where("id", "in", soleHouseholds).execute();
      await db.deleteFrom("auth.users").where("id", "=", id.data).execute();
    });
  } catch (error) {
    console.error("Suppression de compte :", error instanceof Error ? error.message : error);
    return fail("Suppression impossible (des données liées au compte subsistent).");
  }
  await audit(user.id, "account.delete", id.data, { email: target.email });
  return ok("/admin/comptes");
}

// ---------------------------------------------------------------------------
// Administrateurs
// ---------------------------------------------------------------------------

/** Nomme un administrateur (compte existant) avec le rôle `owner` ou `support`, ou change son rôle. */
export async function grantAdmin(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const role = z.enum(["owner", "support"]).safeParse(formData.get("role"));
  if (!email.success || !role.success) return fail("Adresse e-mail ou rôle invalide.");
  const target = await withAdmin((db) =>
    db.selectFrom("auth.users").select(["id", "banned_at"]).where("email", "=", email.data).executeTakeFirst(),
  );
  if (!target) return fail("Aucun compte avec cette adresse : la personne doit d'abord se connecter une fois.");
  if (target.banned_at) return fail("Ce compte est suspendu.");
  if (target.id === user.id && role.data !== "owner") return fail("Tu ne peux pas réduire tes propres droits.");
  await withAdmin((db) =>
    db
      .insertInto("admins")
      .values({ user_id: target.id, role: role.data })
      .onConflict((oc) => oc.column("user_id").doUpdateSet({ role: role.data }))
      .execute(),
  );
  await audit(user.id, "admin.grant", target.id, { role: role.data });
  return ok("/admin/admins");
}

/** Retire les droits d'administrateur (et son second facteur). Le dernier `owner` ne peut pas être retiré. */
export async function revokeAdmin(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("userId"));
  if (!id.success) return fail();
  if (id.data === user.id) return fail("Tu ne peux pas retirer tes propres droits.");
  const owners = await withAdmin((db) =>
    db.selectFrom("admins").select("user_id").where("role", "=", "owner").execute(),
  );
  if (owners.length === 1 && owners[0]?.user_id === id.data) return fail("Il doit rester un administrateur complet.");
  await withAdmin(async (db) => {
    await db.deleteFrom("admins").where("user_id", "=", id.data).execute();
    await db.deleteFrom("auth.admin_totp").where("user_id", "=", id.data).execute();
  });
  await audit(user.id, "admin.revoke", id.data);
  return ok("/admin/admins");
}

/** Réinitialise le second facteur d'un administrateur : il scannera un nouveau QR code à sa prochaine visite. */
export async function resetAdminMfa(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("userId"));
  if (!id.success) return fail();
  await withAdmin(async (db) => {
    await db.deleteFrom("auth.admin_totp").where("user_id", "=", id.data).execute();
    await db.updateTable("auth.sessions").set({ mfa_verified_at: null }).where("user_id", "=", id.data).execute();
  });
  await audit(user.id, "admin.reset_mfa", id.data);
  return ok("/admin/admins");
}

// ---------------------------------------------------------------------------
// Abonnements (Stripe ; la base suit par les webhooks)
// ---------------------------------------------------------------------------

async function stripeSubscriptionOf(householdId: string) {
  const row = await withAdmin((db) =>
    db
      .selectFrom("subscriptions")
      .select("stripe_subscription_id")
      .where("household_id", "=", householdId)
      .executeTakeFirst(),
  );
  return row?.stripe_subscription_id ?? null;
}

const subscriptionInput = z.object({ householdId: z.uuid(), back: z.string().regex(/^\/admin\/[a-z/0-9-]*$/) });

/** Résiliation : à la fin de la période payée, ou tout de suite. */
export async function cancelSubscription(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const input = subscriptionInput.safeParse({ householdId: formData.get("householdId"), back: formData.get("back") });
  const when = formData.get("when") === "now" ? "now" : "period_end";
  if (!input.success || !stripeAvailable()) return fail();
  const subId = await stripeSubscriptionOf(input.data.householdId);
  if (!subId) return fail("Ce foyer n'a pas d'abonnement Stripe.");
  try {
    const stripe = stripeClient();
    if (when === "now") await stripe.subscriptions.cancel(subId);
    else await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
  } catch {
    return fail("Stripe a refusé la résiliation.");
  }
  await audit(user.id, "subscription.cancel", input.data.householdId, { when });
  return ok(input.data.back);
}

/** Rembourse le dernier paiement de l'abonnement (total ou montant en euros). */
export async function refundLastPayment(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const input = subscriptionInput.safeParse({ householdId: formData.get("householdId"), back: formData.get("back") });
  const euros = formData.get("amount") ? z.coerce.number().positive().max(10000).safeParse(formData.get("amount")) : null;
  if (!input.success || !stripeAvailable() || (euros && !euros.success)) return fail();
  const subId = await stripeSubscriptionOf(input.data.householdId);
  if (!subId) return fail("Ce foyer n'a pas d'abonnement Stripe.");
  try {
    const stripe = stripeClient();
    const invoices = await stripe.invoices.list({ subscription: subId, status: "paid", limit: 1 });
    const invoice = invoices.data[0];
    if (!invoice) return fail("Aucun paiement à rembourser.");
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 1 });
    const pi = payments.data[0]?.payment.payment_intent;
    if (!pi) return fail("Paiement introuvable côté Stripe.");
    await stripe.refunds.create({
      payment_intent: typeof pi === "string" ? pi : pi.id,
      ...(euros?.success ? { amount: Math.round(euros.data * 100) } : {}),
    });
  } catch {
    return fail("Stripe a refusé le remboursement (déjà remboursé ?).");
  }
  await audit(user.id, "subscription.refund", input.data.householdId, { amount: euros?.success ? euros.data : "total" });
  return ok(input.data.back);
}

/** Offre un mois : la prochaine facturation est repoussée de 30 jours, sans prorata. */
export async function offerMonth(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const input = subscriptionInput.safeParse({ householdId: formData.get("householdId"), back: formData.get("back") });
  if (!input.success || !stripeAvailable()) return fail();
  const subId = await stripeSubscriptionOf(input.data.householdId);
  if (!subId) return fail("Ce foyer n'a pas d'abonnement Stripe.");
  try {
    const stripe = stripeClient();
    const sub = await stripe.subscriptions.retrieve(subId);
    const periodEnd = sub.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000);
    const base = sub.trial_end && sub.trial_end > periodEnd ? sub.trial_end : periodEnd;
    await stripe.subscriptions.update(subId, {
      trial_end: base + 30 * 24 * 3600,
      proration_behavior: "none",
    });
  } catch {
    return fail("Stripe a refusé l'opération.");
  }
  await audit(user.id, "subscription.offer_month", input.data.householdId);
  return ok(input.data.back);
}
