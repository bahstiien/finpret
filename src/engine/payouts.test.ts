import { describe, expect, it } from "vitest";
import {
  decidePayout,
  lineForInvoice,
  previousQuarter,
  quarterBounds,
  quarterOf,
  refundLine,
} from "./payouts";

describe("reversements", () => {
  it("annuel : +800 centimes, mensuel : +50 centimes", () => {
    expect(lineForInvoice("yearly", 3999)).toEqual({ kind: "yearly", amount: 800 });
    expect(lineForInvoice("yearly", 4999)).toEqual({ kind: "yearly", amount: 800 });
    expect(lineForInvoice("monthly", 599)).toEqual({ kind: "monthly", amount: 50 });
  });
  it("une facture à 0 € ou d'une offre inconnue ne rapporte rien", () => {
    expect(lineForInvoice("yearly", 0)).toBeNull();
    expect(lineForInvoice(null, 599)).toBeNull();
  });

  it("applique les montants propres à l'association, le barème standard si non renseignés", () => {
    expect(lineForInvoice("yearly", 3999, { yearly: 1000, monthly: 80 })).toEqual({ kind: "yearly", amount: 1000 });
    expect(lineForInvoice("monthly", 599, { yearly: 1000, monthly: 80 })).toEqual({ kind: "monthly", amount: 80 });
    expect(lineForInvoice("yearly", 3999, { yearly: null, monthly: null })).toEqual({ kind: "yearly", amount: 800 });
    expect(lineForInvoice("monthly", 599, { yearly: 1000 })).toEqual({ kind: "monthly", amount: 50 });
  });

  it("ne crée aucune ligne quand la rétribution est fixée à 0", () => {
    expect(lineForInvoice("yearly", 3999, { yearly: 0 })).toBeNull();
  });
  it("un remboursement annule exactement la ligne comptée", () => {
    expect(refundLine({ amount_cents: 800 })).toEqual({ kind: "refund", amount: -800 });
  });
});

describe("trimestres", () => {
  it("trouve le trimestre civil", () => {
    expect(quarterOf("2027-01-01")).toBe("2027-T1");
    expect(quarterOf("2027-03-31")).toBe("2027-T1");
    expect(quarterOf("2027-04-01")).toBe("2027-T2");
    expect(quarterOf("2027-12-31")).toBe("2027-T4");
  });
  it("clôture le trimestre précédent", () => {
    expect(previousQuarter("2027-01-01")).toBe("2026-T4");
    expect(previousQuarter("2027-04-01")).toBe("2027-T1");
    expect(previousQuarter("2027-10-01")).toBe("2027-T3");
  });
  it("donne les bornes [début, fin[", () => {
    expect(quarterBounds("2026-T4")).toEqual({ start: "2026-10-01", end: "2027-01-01" });
    expect(quarterBounds("2027-T2")).toEqual({ start: "2027-04-01", end: "2027-07-01" });
  });
});

describe("clôture", () => {
  it("verse dès 20 €, reporte en dessous", () => {
    expect(decidePayout(2000)).toEqual({ status: "ready", amount: 2000 });
    expect(decidePayout(1999)).toEqual({ status: "carried_over", amount: 1999 });
    expect(decidePayout(-800)).toEqual({ status: "carried_over", amount: -800 });
  });
});
