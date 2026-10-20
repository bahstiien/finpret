import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleStripeEvent, type StripeEventLike } from "@/server/stripe-webhook";
import { createFakeDb } from "./fake-db";

vi.mock("@/server/events", () => ({ trackEvent: vi.fn(async () => {}) }));

const cfg = {
  monthlyPrice: "price_m",
  yearlyPrice: "price_y",
  associationCoupon: "coupon_asso",
  webhookSecret: "whsec_test",
};

let n = 0;
const event = (type: string, object: Record<string, unknown>): StripeEventLike => ({
  id: `evt_${++n}`,
  type,
  data: { object },
});
const invoice = (id: string, price: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  customer: "cus_1",
  amount_paid: amount,
  lines: { data: [{ price: { id: price } }] },
  ...extra,
});

function world(associationId: string | null = "asso-1") {
  return createFakeDb({
    households: [{ id: "h1", association_id: associationId }],
    subscriptions: [{ household_id: "h1", plan: "trial", status: "trialing", stripe_customer_id: "cus_1" }],
  });
}

beforeEach(() => {
  n = 0;
});

describe("webhook Stripe", () => {
  it("coupon association : après invoice.paid annuel, +800 pour l'association", async () => {
    const w = world();
    expect(await handleStripeEvent(w.db, event("invoice.paid", invoice("in_1", "price_y", 3999)), cfg)).toBe(
      "processed",
    );
    expect(w.table("payout_lines")).toMatchObject([
      {
        association_id: "asso-1",
        household_id: "h1",
        stripe_invoice_id: "in_1",
        kind: "yearly",
        amount_cents: 800,
      },
    ]);
  });

  it("un mois d'abonnement mensuel rapporte 50 centimes", async () => {
    const w = world();
    await handleStripeEvent(w.db, event("invoice.paid", invoice("in_2", "price_m", 599)), cfg);
    expect(w.table("payout_lines")[0]).toMatchObject({ kind: "monthly", amount_cents: 50 });
  });

  it("sans association, aucune ligne de reversement", async () => {
    const w = world(null);
    await handleStripeEvent(w.db, event("invoice.paid", invoice("in_3", "price_y", 4999)), cfg);
    expect(w.table("payout_lines")).toHaveLength(0);
  });

  it("webhook rejoué : réponse sans effet et aucune ligne créée", async () => {
    const w = world();
    const e = event("invoice.paid", invoice("in_4", "price_y", 3999));
    expect(await handleStripeEvent(w.db, e, cfg)).toBe("processed");
    expect(await handleStripeEvent(w.db, e, cfg)).toBe("duplicate");
    expect(w.table("payout_lines")).toHaveLength(1);
    expect(w.table("stripe_events")).toHaveLength(1);
  });

  it("une même facture dans deux événements différents ne compte qu'une fois", async () => {
    const w = world();
    await handleStripeEvent(w.db, event("invoice.paid", invoice("in_5", "price_y", 3999)), cfg);
    await handleStripeEvent(w.db, event("invoice.paid", invoice("in_5", "price_y", 3999)), cfg);
    expect(w.table("payout_lines")).toHaveLength(1);
  });

  it("un remboursement ajoute une ligne négative du même montant, une seule fois", async () => {
    const w = world();
    await handleStripeEvent(w.db, event("invoice.paid", invoice("in_6", "price_y", 3999)), cfg);
    await handleStripeEvent(w.db, event("charge.refunded", { invoice: "in_6" }), cfg);
    await handleStripeEvent(w.db, event("charge.dispute.created", { charge_invoice: "in_6" }), cfg);
    const lines = w.table("payout_lines");
    expect(lines.map((l) => l.amount_cents)).toEqual([800, -800]);
    expect(lines[1]).toMatchObject({ kind: "refund", stripe_invoice_id: "in_6" });
  });

  it("un remboursement sur une facture jamais comptée est sans effet", async () => {
    const w = world();
    await handleStripeEvent(w.db, event("charge.refunded", { invoice: "in_inconnue" }), cfg);
    expect(w.table("payout_lines")).toHaveLength(0);
  });

  it("abonnement créé puis supprimé : l'offre passe à payant puis retombe à gratuit, données conservées", async () => {
    const w = world();
    await handleStripeEvent(
      w.db,
      event("customer.subscription.created", {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { household_id: "h1" },
        items: { data: [{ price: { id: "price_y" } }] },
        current_period_end: 1_800_000_000,
      }),
      cfg,
    );
    expect(w.table("subscriptions")[0]).toMatchObject({
      plan: "yearly",
      status: "active",
      stripe_subscription_id: "sub_1",
    });
    await handleStripeEvent(w.db, event("customer.subscription.deleted", { customer: "cus_1" }), cfg);
    expect(w.table("subscriptions")[0]).toMatchObject({
      plan: "free",
      status: "canceled",
      stripe_customer_id: "cus_1",
    });
  });

  it("échec de paiement : l'abonnement passe en impayé", async () => {
    const w = world();
    await handleStripeEvent(w.db, event("invoice.payment_failed", { id: "in_7", customer: "cus_1" }), cfg);
    expect(w.table("subscriptions")[0]).toMatchObject({ status: "past_due" });
  });

  it("facture d'un client inconnu : erreur, et l'événement n'est pas marqué traité (Stripe le renverra)", async () => {
    const w = world();
    const e = event("invoice.paid", { ...invoice("in_8", "price_y", 3999), customer: "cus_inconnu" });
    await expect(handleStripeEvent(w.db, e, cfg)).rejects.toThrow(/introuvable/);
    expect(w.table("stripe_events")).toHaveLength(0);
  });

  it("ignore les événements non traités", async () => {
    const w = world();
    expect(await handleStripeEvent(w.db, event("customer.created", {}), cfg)).toBe("ignored");
    expect(w.table("stripe_events")).toHaveLength(0);
  });

  it("la signature d'un événement généré pour les tests se vérifie avec la clé du webhook", () => {
    const stripe = new Stripe("sk_test_dummy");
    const payload = JSON.stringify({
      id: "evt_sig",
      object: "event",
      type: "invoice.paid",
      data: { object: {} },
    });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: cfg.webhookSecret });
    expect(stripe.webhooks.constructEvent(payload, header, cfg.webhookSecret).id).toBe("evt_sig");
    expect(() => stripe.webhooks.constructEvent(payload, header, "whsec_autre")).toThrow();
  });
});
