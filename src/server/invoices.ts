import "server-only";
import { type InvoiceRow, toInvoiceRows } from "@/lib/invoices";
import { stripeAvailable, stripeClient } from "@/server/stripe";

/** 24 dernières factures du client Stripe ; `null` si Stripe est indisponible (l'écran affiche alors un message). */
export async function listInvoices(customerId: string): Promise<InvoiceRow[] | null> {
  if (!stripeAvailable()) return null;
  try {
    const { data } = await stripeClient().invoices.list({ customer: customerId, limit: 24 });
    return toInvoiceRows(data);
  } catch (error) {
    console.error("Stripe factures :", error instanceof Error ? error.message : error);
    return null;
  }
}
