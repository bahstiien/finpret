import { describe, expect, it } from "vitest";
import { brandLabel, cardExpired, toBillingDetails } from "@/lib/billing";

const periodEnd = Date.UTC(2026, 10, 15, 10) / 1000;
const card = { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 };

describe("toBillingDetails", () => {
  it("lit la période, la ligne et la carte par défaut de l'abonnement", () => {
    expect(
      toBillingDetails({
        items: { data: [{ id: "si_1", current_period_end: periodEnd }] },
        cancel_at_period_end: false,
        cancel_at: null,
        default_payment_method: { card },
      }),
    ).toEqual({
      itemId: "si_1",
      periodEnd: "2026-11-15",
      cancelsOn: null,
      card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 },
    });
  });

  it("annonce la fin de l'abonnement quand la résiliation est demandée", () => {
    const details = toBillingDetails({
      current_period_end: periodEnd,
      items: { data: [{ id: "si_1" }] },
      cancel_at_period_end: true,
    });
    expect(details.cancelsOn).toBe("2026-11-15");
  });

  it("retombe sur la carte par défaut du client", () => {
    const details = toBillingDetails({
      items: { data: [] },
      default_payment_method: "pm_1",
      customer: { invoice_settings: { default_payment_method: { card } } },
    });
    expect(details.card?.last4).toBe("4242");
    expect(details.itemId).toBeNull();
  });

  it("sans carte ni période, tout est vide", () => {
    expect(toBillingDetails(null)).toEqual({ itemId: null, periodEnd: null, cancelsOn: null, card: null });
  });
});

describe("carte", () => {
  it("détecte une carte expirée, pas celle du mois courant", () => {
    const now = new Date(Date.UTC(2026, 9, 21));
    expect(cardExpired({ expMonth: 9, expYear: 2026 }, now)).toBe(true);
    expect(cardExpired({ expMonth: 10, expYear: 2026 }, now)).toBe(false);
  });

  it("nomme les réseaux courants", () => {
    expect(brandLabel("visa")).toBe("Visa");
    expect(brandLabel("inconnu")).toBe("Carte");
  });
});
