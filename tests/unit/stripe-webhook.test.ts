import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { chargeInvoiceId, handleStripeEvent, type StripeEventLike } from "@/server/stripe-webhook";
import { createTestDb, type TestDb } from "./pglite-db";

vi.mock("@/server/events", () => ({ trackEvent: vi.fn(async () => {}) }));

const cfg = {
  monthlyPrice: "price_m",
  yearlyPrice: "price_y",
  associationCoupon: "coupon_asso",
  webhookSecret: "whsec_test",
};

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

// Une seule base pour tout le fichier : identifiants d'événement, de client et de facture uniques par test.
let n = 0;
const event = (type: string, object: Record<string, unknown>): StripeEventLike => ({
  id: `evt_${++n}`,
  type,
  data: { object },
});

type World = { householdId: string; associationId: string | null; customer: string };

const invoice = (
  w: World,
  id: string,
  price: string,
  amount: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  customer: w.customer,
  amount_paid: amount,
  lines: { data: [{ price: { id: price } }] },
  ...extra,
});

/** Foyer en essai (abonnement créé par trigger), rattaché ou non à une association, client Stripe connu. */
async function world(withAssociation = true): Promise<World> {
  const k = ++n;
  const customer = `cus_${k}`;
  return db.admin(async (tx) => {
    const association = withAssociation
      ? await tx
          .insertInto("associations")
          .values({
            name: `Association ${k}`,
            rna_or_siren: "W123456789",
            email: `asso${k}@test.fr`,
            manager_name: "Camille",
            code: `ASSO-${k}`,
            status: "approved",
          })
          .returning("id")
          .executeTakeFirstOrThrow()
      : null;
    const household = await tx
      .insertInto("households")
      .values({ name: `Foyer ${k}`, association_id: association?.id ?? null })
      .returning("id")
      .executeTakeFirstOrThrow();
    await tx
      .updateTable("subscriptions")
      .set({ stripe_customer_id: customer })
      .where("household_id", "=", household.id)
      .execute();
    return { householdId: household.id, associationId: association?.id ?? null, customer };
  });
}

const handle = (e: StripeEventLike) => db.admin((tx) => handleStripeEvent(tx, e, cfg));

const payoutLines = (invoiceId: string) =>
  db.admin((tx) =>
    tx
      .selectFrom("payout_lines")
      .selectAll()
      .where("stripe_invoice_id", "=", invoiceId)
      .orderBy("amount_cents", "desc")
      .execute(),
  );

const subscription = (householdId: string) =>
  db.admin((tx) =>
    tx
      .selectFrom("subscriptions")
      .selectAll()
      .where("household_id", "=", householdId)
      .executeTakeFirstOrThrow(),
  );

const storedEvents = (id: string) =>
  db.admin((tx) => tx.selectFrom("stripe_events").select("id").where("id", "=", id).execute());

describe("webhook Stripe", () => {
  it("coupon association : après invoice.paid annuel, +800 pour l'association", async () => {
    const w = await world();
    expect(await handle(event("invoice.paid", invoice(w, "in_1", "price_y", 3999)))).toBe("processed");
    expect(await payoutLines("in_1")).toMatchObject([
      {
        association_id: w.associationId,
        household_id: w.householdId,
        stripe_invoice_id: "in_1",
        kind: "yearly",
        amount_cents: 800,
      },
    ]);
  });

  it("un mois d'abonnement mensuel rapporte 50 centimes", async () => {
    const w = await world();
    await handle(event("invoice.paid", invoice(w, "in_2", "price_m", 599)));
    expect((await payoutLines("in_2"))[0]).toMatchObject({ kind: "monthly", amount_cents: 50 });
  });

  it("sans association, aucune ligne de reversement", async () => {
    const w = await world(false);
    await handle(event("invoice.paid", invoice(w, "in_3", "price_y", 4999)));
    expect(await payoutLines("in_3")).toHaveLength(0);
  });

  it("webhook rejoué : réponse sans effet et aucune ligne créée", async () => {
    const w = await world();
    const e = event("invoice.paid", invoice(w, "in_4", "price_y", 3999));
    expect(await handle(e)).toBe("processed");
    expect(await handle(e)).toBe("duplicate");
    expect(await payoutLines("in_4")).toHaveLength(1);
    expect(await storedEvents(e.id)).toHaveLength(1);
  });

  it("une même facture dans deux événements différents ne compte qu'une fois", async () => {
    const w = await world();
    await handle(event("invoice.paid", invoice(w, "in_5", "price_y", 3999)));
    await handle(event("invoice.paid", invoice(w, "in_5", "price_y", 3999)));
    expect(await payoutLines("in_5")).toHaveLength(1);
  });

  it("un remboursement ajoute une ligne négative du même montant, une seule fois", async () => {
    const w = await world();
    await handle(event("invoice.paid", invoice(w, "in_6", "price_y", 3999)));
    // Forme actuelle : pas de `invoice` sur le charge, la route ajoute `charge_invoice` (chargeInvoiceId).
    await handle(event("charge.refunded", { charge_invoice: "in_6", refunded: true }));
    await handle(event("charge.dispute.created", { charge_invoice: "in_6" }));
    const lines = await payoutLines("in_6");
    expect(lines.map((l) => l.amount_cents)).toEqual([800, -800]);
    expect(lines[1]).toMatchObject({ kind: "refund", stripe_invoice_id: "in_6" });
  });

  it("un litige gagné rend la part : ligne retirée si pas encore versée", async () => {
    const w = await world();
    await handle(event("invoice.paid", invoice(w, "in_d1", "price_y", 3999)));
    await handle(event("charge.dispute.created", { charge_invoice: "in_d1" }));
    await handle(event("charge.dispute.closed", { charge_invoice: "in_d1", status: "lost" }));
    expect((await payoutLines("in_d1")).map((l) => l.amount_cents)).toEqual([800, -800]);
    await handle(event("charge.dispute.closed", { charge_invoice: "in_d1", status: "won" }));
    await handle(event("charge.dispute.closed", { charge_invoice: "in_d1", status: "won" }));
    expect((await payoutLines("in_d1")).map((l) => l.amount_cents)).toEqual([800]);
  });

  it("un litige gagné après versement ajoute une ligne de compensation, une seule fois", async () => {
    const w = await world();
    await handle(event("invoice.paid", invoice(w, "in_d2", "price_y", 3999)));
    await handle(event("charge.dispute.created", { charge_invoice: "in_d2" }));
    // Trimestre clôturé et versé : la ligne négative est déjà dans un versement.
    await db.admin(async (tx) => {
      const { id } = await tx
        .insertInto("payouts")
        .values({ association_id: w.associationId!, quarter: "2099-T1", amount_cents: 0, status: "paid" })
        .returning("id")
        .executeTakeFirstOrThrow();
      await tx
        .updateTable("payout_lines")
        .set({ payout_id: id })
        .where("stripe_invoice_id", "=", "in_d2")
        .execute();
    });
    await handle(event("charge.dispute.closed", { charge_invoice: "in_d2", status: "won" }));
    await handle(event("charge.dispute.closed", { charge_invoice: "in_d2", status: "won" }));
    expect((await payoutLines("in_d2")).map((l) => l.amount_cents).sort((a, b) => a - b)).toEqual([
      -800, 800, 800,
    ]);
  });

  it("retrouve la facture d'un charge ou d'un litige par son payment_intent", async () => {
    const list = vi.fn(async () => ({ data: [{ invoice: { id: "in_pi" } }] }));
    const stripe = { invoicePayments: { list } };
    expect(await chargeInvoiceId(stripe, { id: "ch_1", payment_intent: "pi_1" })).toBe("in_pi");
    expect(list).toHaveBeenCalledWith({
      payment: { type: "payment_intent", payment_intent: "pi_1" },
      limit: 1,
    });
    expect(await chargeInvoiceId(stripe, { id: "dp_1", payment_intent: { id: "pi_2" } })).toBe("in_pi");
    expect(await chargeInvoiceId(stripe, { id: "ch_2", payment_intent: null })).toBeNull();
    const empty = { invoicePayments: { list: async () => ({ data: [] }) } };
    expect(await chargeInvoiceId(empty, { payment_intent: "pi_3" })).toBeNull();
  });

  it("un remboursement partiel ne retire pas la part de l'association", async () => {
    const w = await world();
    await handle(event("invoice.paid", invoice(w, "in_6b", "price_y", 3999)));
    await handle(event("charge.refunded", { invoice: "in_6b", refunded: false, amount_refunded: 100 }));
    expect((await payoutLines("in_6b")).map((l) => l.amount_cents)).toEqual([800]);
  });

  it("un remboursement sur une facture jamais comptée est sans effet", async () => {
    await world();
    await handle(event("charge.refunded", { invoice: "in_inconnue", refunded: true }));
    expect(await payoutLines("in_inconnue")).toHaveLength(0);
  });

  it("abonnement créé puis supprimé : l'offre passe à payant puis retombe à gratuit, données conservées", async () => {
    const w = await world();
    await handle(
      event("customer.subscription.created", {
        id: "sub_1",
        customer: w.customer,
        status: "active",
        metadata: { household_id: w.householdId },
        items: { data: [{ price: { id: "price_y" } }] },
        current_period_end: 1_800_000_000,
      }),
    );
    expect(await subscription(w.householdId)).toMatchObject({
      plan: "yearly",
      status: "active",
      stripe_subscription_id: "sub_1",
    });
    await handle(event("customer.subscription.deleted", { customer: w.customer }));
    expect(await subscription(w.householdId)).toMatchObject({
      plan: "free",
      status: "canceled",
      stripe_customer_id: w.customer,
    });
  });

  it("résiliation programmée : mémorisée (pas de rappel de reconduction), puis levée à la reprise", async () => {
    const w = await world();
    const sub = (cancel: boolean) =>
      event("customer.subscription.updated", {
        id: "sub_2",
        customer: w.customer,
        status: "active",
        metadata: { household_id: w.householdId },
        items: { data: [{ price: { id: "price_y" } }] },
        current_period_end: 1_800_000_000,
        cancel_at_period_end: cancel,
      });
    await handle(sub(true));
    expect(await subscription(w.householdId)).toMatchObject({ plan: "yearly", cancel_at_period_end: true });
    await handle(sub(false));
    expect(await subscription(w.householdId)).toMatchObject({ cancel_at_period_end: false });
  });

  it("échec de paiement : l'abonnement passe en impayé", async () => {
    const w = await world();
    await handle(event("invoice.payment_failed", { id: "in_7", customer: w.customer }));
    expect(await subscription(w.householdId)).toMatchObject({ status: "past_due" });
  });

  it("facture d'un client inconnu : erreur, et l'événement n'est pas marqué traité (Stripe le renverra)", async () => {
    const w = await world();
    const e = event("invoice.paid", { ...invoice(w, "in_8", "price_y", 3999), customer: "cus_inconnu" });
    await expect(handle(e)).rejects.toThrow(/introuvable/);
    expect(await storedEvents(e.id)).toHaveLength(0);
  });

  it("ignore les événements non traités", async () => {
    await world();
    const e = event("customer.created", {});
    expect(await handle(e)).toBe("ignored");
    expect(await storedEvents(e.id)).toHaveLength(0);
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
