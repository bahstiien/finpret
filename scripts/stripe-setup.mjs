// Crée ou retrouve les objets Stripe de Fin Prêt en MODE TEST et affiche les variables à copier dans .env.local.
// Usage : STRIPE_SECRET_KEY=sk_test_... pnpm stripe:setup
// Produit « Fin Prêt Famille », prix mensuel 5,99 € et annuel 49,99 € (TTC, TVA 20 % incluse),
// coupon d'association -10 € (une seule fois, donc 39,99 € la première année).
import Stripe from "stripe";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnvLocal();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY manque (clé de TEST : sk_test_…).");
  process.exit(1);
}
if (!key.startsWith("sk_test_")) {
  console.error("Ce script ne s'exécute qu'avec une clé de test (sk_test_…). La production se configure à la main, le 2 janvier.");
  process.exit(1);
}
const stripe = new Stripe(key);

const PRODUCT_NAME = "Fin Prêt Famille";
const COUPON_ID = "ASSOCIATION_10";

async function findProduct() {
  for await (const p of stripe.products.list({ active: true, limit: 100 })) if (p.name === PRODUCT_NAME) return p;
  return stripe.products.create({ name: PRODUCT_NAME, description: "Abonnement famille Fin Prêt" });
}

async function ensurePrice(product, lookupKey, amount, interval) {
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (found.data[0]) return found.data[0];
  return stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: amount,
    tax_behavior: "inclusive",
    recurring: { interval },
    lookup_key: lookupKey,
  });
}

async function ensureCoupon() {
  try {
    return await stripe.coupons.retrieve(COUPON_ID);
  } catch {
    return stripe.coupons.create({ id: COUPON_ID, amount_off: 1000, currency: "eur", duration: "once", name: "Association -10 €" });
  }
}

const product = await findProduct();
const monthly = await ensurePrice(product, "finpret_monthly", 599, "month");
const yearly = await ensurePrice(product, "finpret_yearly", 4999, "year");
const coupon = await ensureCoupon();

console.log("# À copier dans .env.local (mode test)");
console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
console.log(`STRIPE_PRICE_YEARLY=${yearly.id}`);
console.log(`STRIPE_COUPON_ASSOCIATION=${coupon.id}`);
console.log("# STRIPE_WEBHOOK_SECRET : `stripe listen --forward-to localhost:3000/api/stripe/webhook` ou le tableau de bord.");
