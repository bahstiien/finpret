import "server-only";
import Stripe from "stripe";

export type StripeConfig = {
  monthlyPrice: string;
  yearlyPrice: string;
  associationCoupon: string;
  webhookSecret: string;
};

/** Identifiants créés par `pnpm stripe:setup` (voir .env.example). */
export function stripeConfig(env: NodeJS.ProcessEnv = process.env): StripeConfig {
  return {
    monthlyPrice: env.STRIPE_PRICE_MONTHLY ?? "",
    yearlyPrice: env.STRIPE_PRICE_YEARLY ?? "",
    associationCoupon: env.STRIPE_COUPON_ASSOCIATION ?? "",
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
  };
}

export const stripeAvailable = () => !!process.env.STRIPE_SECRET_KEY;

/** Client Stripe (clé secrète, serveur uniquement). */
export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manque (voir .env.example).");
  return new Stripe(key);
}

/** Offre correspondant à un prix Stripe. */
export function planOfPrice(
  priceId: string | null | undefined,
  cfg: Pick<StripeConfig, "monthlyPrice" | "yearlyPrice">,
) {
  if (!priceId) return null;
  if (priceId === cfg.yearlyPrice) return "yearly" as const;
  if (priceId === cfg.monthlyPrice) return "monthly" as const;
  return null;
}
