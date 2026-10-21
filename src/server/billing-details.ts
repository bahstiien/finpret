import "server-only";
import { type BillingDetails, toBillingDetails } from "@/lib/billing";
import { stripeAvailable, stripeClient } from "@/server/stripe";

/** Résiliation prévue, carte enregistrée et ligne d'abonnement ; `null` si Stripe ne répond pas. */
export async function getBillingDetails(subscriptionId: string): Promise<BillingDetails | null> {
  if (!stripeAvailable()) return null;
  try {
    const sub = await stripeClient().subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method", "customer.invoice_settings.default_payment_method"],
    });
    return toBillingDetails(sub);
  } catch (error) {
    console.error("Stripe abonnement :", error instanceof Error ? error.message : error);
    return null;
  }
}
