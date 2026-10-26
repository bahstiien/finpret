/** Facture affichée dans /app/abonnement (extraite d'une facture Stripe). */
export type InvoiceRow = {
  id: string;
  number: string;
  /** Date de la facture, `AAAA-MM-JJ`. */
  date: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  /** Page hébergée Stripe : consultation et, si la facture est ouverte, paiement. */
  hostedUrl: string | null;
  pdfUrl: string | null;
};

type StripeInvoiceLike = {
  id: string;
  number?: string | null;
  created: number;
  total: number;
  currency: string;
  status?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
};

const STATUSES = ["paid", "open", "void", "uncollectible"] as const;

/** Garde les factures émises (pas les brouillons) et ne retient que ce que l'écran affiche. */
export function toInvoiceRows(invoices: StripeInvoiceLike[]): InvoiceRow[] {
  return invoices.flatMap((i) => {
    const status = STATUSES.find((s) => s === i.status);
    if (!status) return [];
    return [
      {
        id: i.id,
        number: i.number ?? i.id,
        date: new Date(i.created * 1000).toISOString().slice(0, 10),
        amount: i.total / 100,
        currency: i.currency.toUpperCase(),
        status,
        hostedUrl: i.hosted_invoice_url ?? null,
        pdfUrl: i.invoice_pdf ?? null,
      },
    ];
  });
}
