import "server-only";
import { lineForInvoice, refundLine } from "@/engine/payouts";
import type { Json } from "@/lib/supabase/database.types";
import type { Db } from "@/lib/supabase/types";
import { trackEvent } from "@/server/events";
import { planOfPrice, type StripeConfig } from "@/server/stripe";

/**
 * Traitement des événements Stripe (SPEC_JANVIER §6). Idempotent : l'événement est d'abord inscrit dans
 * `stripe_events` (clé primaire = event.id) ; un doublon est ignoré. Si le traitement échoue, l'inscription
 * est retirée pour que la nouvelle tentative de Stripe soit traitée.
 * Les objets Stripe sont lus de façon tolérante : la forme des factures a changé entre versions de l'API.
 */

export type StripeEventLike = { id: string; type: string; data: { object: unknown } };
type Obj = Record<string, unknown>;

const asObj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const idOf = (v: unknown): string | null => str(v) ?? str(asObj(v).id);
const iso = (seconds: unknown) =>
  typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;

export type WebhookResult = "processed" | "duplicate" | "ignored";

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
] as const;

/** Prix d'une facture : `lines.data[0].price.id` (ancienne forme) ou `pricing.price_details.price` (récente). */
export function invoicePriceId(invoice: Obj): string | null {
  const line = asObj(
    asObj(asObj(invoice.lines).data instanceof Array ? (asObj(invoice.lines).data as unknown[])[0] : null),
  );
  return idOf(line.price) ?? idOf(asObj(asObj(line.pricing).price_details).price);
}

/** Foyer indiqué par les métadonnées de l'abonnement, selon la forme de la facture. */
function invoiceHint(invoice: Obj): string | null {
  const fromDetails = (d: unknown) => str(asObj(asObj(d).metadata).household_id);
  return fromDetails(invoice.subscription_details) ?? fromDetails(asObj(invoice.parent).subscription_details);
}

async function householdOfCustomer(
  db: Db,
  customerId: string | null,
  hint?: string | null,
): Promise<string | null> {
  if (hint) return hint;
  if (!customerId) return null;
  const { data } = await db
    .from("subscriptions")
    .select("household_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.household_id ?? null;
}

export type WebhookHooks = { paymentFailed?: (householdId: string) => Promise<void> };

export async function handleStripeEvent(
  db: Db,
  event: StripeEventLike,
  cfg: StripeConfig,
  hooks: WebhookHooks = {},
): Promise<WebhookResult> {
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return "ignored";

  const { error: insertError } = await db
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, payload: event as unknown as Json });
  if (insertError) {
    if (insertError.code === "23505") return "duplicate";
    throw new Error(`stripe_events : ${insertError.message}`);
  }
  try {
    await process(db, event, cfg, hooks);
    return "processed";
  } catch (error) {
    await db.from("stripe_events").delete().eq("id", event.id);
    throw error;
  }
}

async function process(db: Db, event: StripeEventLike, cfg: StripeConfig, hooks: WebhookHooks) {
  const obj = asObj(event.data.object);
  switch (event.type) {
    case "checkout.session.completed": {
      const householdId = str(obj.client_reference_id);
      if (!householdId) return;
      await db
        .from("subscriptions")
        .update({
          stripe_customer_id: idOf(obj.customer),
          stripe_subscription_id: idOf(obj.subscription),
          updated_at: new Date().toISOString(),
        })
        .eq("household_id", householdId);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const customerId = idOf(obj.customer);
      const householdId = await householdOfCustomer(db, customerId, str(asObj(obj.metadata).household_id));
      if (!householdId) return;
      const items = asObj(obj.items).data;
      const priceId = Array.isArray(items) ? idOf(asObj(asObj(items[0]).price)) : null;
      const plan = planOfPrice(priceId, cfg);
      const status = str(obj.status) ?? "active";
      const active = ["active", "trialing", "past_due"].includes(status);
      const periodEnd =
        iso(obj.current_period_end) ?? iso(asObj(Array.isArray(items) ? items[0] : {}).current_period_end);
      const { data: before } = await db
        .from("subscriptions")
        .select("plan, status")
        .eq("household_id", householdId)
        .maybeSingle();
      await db
        .from("subscriptions")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: str(obj.id),
          plan: active && plan ? plan : active ? (before?.plan ?? "free") : "free",
          status,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("household_id", householdId);
      if (
        active &&
        plan &&
        !(before && before.plan === plan && ["active", "trialing", "past_due"].includes(before.status))
      ) {
        await trackEvent("subscribed", { householdId, props: { plan } });
      }
      return;
    }
    case "customer.subscription.deleted": {
      const householdId = await householdOfCustomer(
        db,
        idOf(obj.customer),
        str(asObj(obj.metadata).household_id),
      );
      if (!householdId) return;
      // Données conservées : seul le droit retombe à « gratuit ».
      await db
        .from("subscriptions")
        .update({
          plan: "free",
          status: "canceled",
          current_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq("household_id", householdId);
      return;
    }
    case "invoice.paid": {
      const householdId = await householdOfCustomer(db, idOf(obj.customer), invoiceHint(obj));
      // Foyer introuvable (facture arrivée avant la fin du paiement) : erreur, Stripe renverra l'événement.
      if (!householdId) throw new Error(`foyer introuvable pour la facture ${str(obj.id)}`);
      await db
        .from("subscriptions")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("household_id", householdId);
      const { data: household } = await db
        .from("households")
        .select("association_id")
        .eq("id", householdId)
        .maybeSingle();
      const associationId = household?.association_id;
      const invoiceId = str(obj.id);
      if (!associationId || !invoiceId) return;
      const line = lineForInvoice(planOfPrice(invoicePriceId(obj), cfg), num(obj.amount_paid));
      if (!line) return;
      const { error } = await db.from("payout_lines").insert({
        association_id: associationId,
        household_id: householdId,
        stripe_invoice_id: invoiceId,
        kind: line.kind,
        amount_cents: line.amount,
      });
      // Une facture ne compte qu'une fois (index unique) : un doublon est normal, pas une erreur.
      if (error && error.code !== "23505") throw new Error(`payout_lines : ${error.message}`);
      return;
    }
    case "invoice.payment_failed": {
      const householdId = await householdOfCustomer(db, idOf(obj.customer), invoiceHint(obj));
      if (!householdId) throw new Error(`foyer introuvable pour la facture ${str(obj.id)}`);
      await db
        .from("subscriptions")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("household_id", householdId);
      await hooks.paymentFailed?.(householdId);
      return;
    }
    case "charge.refunded":
    case "charge.dispute.created": {
      // Facture du paiement : sur le charge, ou ajoutée par la route (`charge_invoice`) pour un litige.
      const invoiceId = idOf(obj.invoice) ?? str(obj.charge_invoice);
      if (!invoiceId) return;
      const { data: counted } = await db
        .from("payout_lines")
        .select("association_id, household_id, amount_cents")
        .eq("stripe_invoice_id", invoiceId)
        .neq("kind", "refund")
        .maybeSingle();
      if (!counted) return; // facture jamais comptée : rien à annuler
      const { data: already } = await db
        .from("payout_lines")
        .select("id")
        .eq("stripe_invoice_id", invoiceId)
        .eq("kind", "refund")
        .maybeSingle();
      if (already) return;
      const r = refundLine(counted);
      await db.from("payout_lines").insert({
        association_id: counted.association_id,
        household_id: counted.household_id,
        stripe_invoice_id: invoiceId,
        kind: r.kind,
        amount_cents: r.amount,
      });
      return;
    }
  }
}
