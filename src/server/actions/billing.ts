"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeCode } from "@/lib/association-code";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { approvedAssociation, attachHousehold } from "@/server/associations";
import { stripeAvailable, stripeClient, stripeConfig } from "@/server/stripe";
import { requireHousehold } from "@/server/session";

const t = fr.subscription;

export type BillingState = { error?: string; ok?: string };

/** Page Réglages › Abonnement (l’ancienne adresse /app/abonnement y redirige). */
const BASE = "/settings/subscription";
const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Stripe Checkout (mode abonnement) : e-mail du compte, foyer en `client_reference_id`, coupon d'association
 * appliqué automatiquement à l'annuel d'un foyer rattaché, TVA incluse dans le prix, adresse de facturation demandée.
 */
export async function createCheckoutSession(formData: FormData) {
  const { user, household } = await requireHousehold(BASE);
  if (household.role !== "admin") redirect(`${BASE}?error=notAdmin`);
  const plan = z.enum(["monthly", "yearly"]).safeParse(formData.get("plan"));
  if (!plan.success) redirect(`${BASE}?error=generic`);
  const cfg = stripeConfig();
  if (!stripeAvailable() || !cfg.monthlyPrice || !cfg.yearlyPrice) redirect(`${BASE}?error=notConfigured`);

  const supabase = await createClient();
  const [{ data: h }, { data: sub }] = await Promise.all([
    supabase.from("households").select("association_id").eq("id", household.id).single(),
    supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("household_id", household.id)
      .maybeSingle(),
  ]);
  const useCoupon = !!h?.association_id && plan.data === "yearly" && !!cfg.associationCoupon;

  let url: string | null = null;
  try {
    const session = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.data === "yearly" ? cfg.yearlyPrice : cfg.monthlyPrice, quantity: 1 }],
      ...(sub?.stripe_customer_id ? { customer: sub.stripe_customer_id } : { customer_email: user.email }),
      client_reference_id: household.id,
      subscription_data: { metadata: { household_id: household.id } },
      ...(useCoupon ? { discounts: [{ coupon: cfg.associationCoupon }] } : {}),
      automatic_tax: { enabled: false },
      billing_address_collection: "required",
      // Rétractation de 14 jours et renonciation : case à cocher (texte juridique à fournir, TODO(juriste)).
      consent_collection: { terms_of_service: "required" },
      locale: "fr",
      success_url: `${appUrl()}${BASE}?ok=1`,
      cancel_url: `${appUrl()}${BASE}`,
    });
    url = session.url;
  } catch (error) {
    console.error("Stripe Checkout :", error instanceof Error ? error.message : error);
  }
  if (!url) redirect(`${BASE}?error=generic`);
  redirect(url);
}

/** Portail client Stripe : changer de formule, carte, résiliation, factures. */
export async function createPortalSession() {
  const { household } = await requireHousehold(BASE);
  if (household.role !== "admin") redirect(`${BASE}?error=notAdmin`);
  if (!stripeAvailable()) redirect(`${BASE}?error=notConfigured`);
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("household_id", household.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) redirect(`${BASE}?error=generic`);
  let url: string | null = null;
  try {
    const session = await stripeClient().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl()}${BASE}`,
    });
    url = session.url;
  } catch (error) {
    console.error("Stripe portail :", error instanceof Error ? error.message : error);
  }
  if (!url) redirect(`${BASE}?error=generic`);
  redirect(url);
}

/** « J'ai un code d'association » : rattache le foyer (D11) et prolonge l'essai à 30 jours. */
export async function applyAssociationCode(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const { user, household } = await requireHousehold(BASE);
  if (household.role !== "admin") return { error: t.errors.notAdmin };
  const association = await approvedAssociation(normalizeCode(String(formData.get("code") ?? "")));
  if (!association) return { error: t.codeInvalid };
  const res = await attachHousehold(household.id, association.id, user.id);
  if (!res.ok) return { error: t.codeLocked };
  return { ok: t.codeOk };
}

/** Abonnement Stripe du foyer pour une action d'administrateur ; redirige avec une erreur sinon. */
async function adminSubscription() {
  const { household } = await requireHousehold(BASE);
  if (household.role !== "admin") redirect(`${BASE}?error=notAdmin`);
  if (!stripeAvailable()) redirect(`${BASE}?error=notConfigured`);
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("household_id", household.id)
    .maybeSingle();
  if (!sub?.stripe_subscription_id) redirect(`${BASE}?error=generic`);
  return { customerId: sub.stripe_customer_id, subscriptionId: sub.stripe_subscription_id };
}

/** Résiliation à la fin de la période payée (rien n'est remboursé, rien ne s'arrête tout de suite). */
async function setCancelAtPeriodEnd(cancel: boolean) {
  const { subscriptionId } = await adminSubscription();
  try {
    await stripeClient().subscriptions.update(subscriptionId, { cancel_at_period_end: cancel });
  } catch (error) {
    console.error("Stripe résiliation :", error instanceof Error ? error.message : error);
    redirect(`${BASE}?error=generic`);
  }
  revalidatePath(BASE);
  redirect(`${BASE}?ok=${cancel ? "canceled" : "resumed"}`);
}

export async function cancelSubscription() {
  await setCancelAtPeriodEnd(true);
}

export async function resumeSubscription() {
  await setCancelAtPeriodEnd(false);
}

/** Passage du mensuel à l'annuel (ou l'inverse) : prorata calculé par Stripe, effet immédiat. */
export async function changePlan(formData: FormData) {
  const plan = z.enum(["monthly", "yearly"]).safeParse(formData.get("plan"));
  if (!plan.success) redirect(`${BASE}?error=generic`);
  const cfg = stripeConfig();
  const price = plan.data === "yearly" ? cfg.yearlyPrice : cfg.monthlyPrice;
  if (!price) redirect(`${BASE}?error=notConfigured`);
  const { subscriptionId } = await adminSubscription();
  try {
    const stripe = stripeClient();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const item = sub.items.data[0];
    if (!item) throw new Error("Abonnement sans ligne.");
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
    });
  } catch (error) {
    console.error("Stripe changement de formule :", error instanceof Error ? error.message : error);
    redirect(`${BASE}?error=generic`);
  }
  revalidatePath(BASE);
  redirect(`${BASE}?ok=changed`);
}

/** Portail Stripe ouvert directement sur la mise à jour de la carte. */
export async function updatePaymentMethod() {
  const { customerId } = await adminSubscription();
  if (!customerId) redirect(`${BASE}?error=generic`);
  let url: string | null = null;
  try {
    const session = await stripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}${BASE}`,
      flow_data: { type: "payment_method_update" },
    });
    url = session.url;
  } catch (error) {
    console.error("Stripe carte :", error instanceof Error ? error.message : error);
  }
  if (!url) redirect(`${BASE}?error=generic`);
  redirect(url);
}
