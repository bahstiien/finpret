import { describe, expect, it } from "vitest";
import { toInvoiceRows } from "@/lib/invoices";

const base = { id: "in_1", created: Date.UTC(2026, 9, 15, 10) / 1000, total: 4999, currency: "eur" };

describe("toInvoiceRows", () => {
  it("convertit une facture payée", () => {
    expect(
      toInvoiceRows([
        {
          ...base,
          number: "ABC-0001",
          status: "paid",
          hosted_invoice_url: "https://h",
          invoice_pdf: "https://p",
        },
      ]),
    ).toEqual([
      {
        id: "in_1",
        number: "ABC-0001",
        date: "2026-10-15",
        amount: 49.99,
        currency: "EUR",
        status: "paid",
        hostedUrl: "https://h",
        pdfUrl: "https://p",
      },
    ]);
  });

  it("ignore les brouillons et garde les factures ouvertes", () => {
    const rows = toInvoiceRows([
      { ...base, id: "in_draft", status: "draft" },
      { ...base, id: "in_open", status: "open" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["in_open"]);
    expect(rows[0]?.number).toBe("in_open");
    expect(rows[0]?.pdfUrl).toBeNull();
  });
});
