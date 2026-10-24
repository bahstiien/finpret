/** État de facturation affiché dans Réglages › Abonnement, extrait d'un abonnement Stripe. */
export type BillingDetails = {
  /** Identifiant de la ligne d'abonnement (nécessaire pour changer de formule). */
  itemId: string | null;
  /** Fin de la période payée, `AAAA-MM-JJ`. */
  periodEnd: string | null;
  /** Date à laquelle l'abonnement s'arrête s'il est résilié (« annulation prévue »), sinon `null`. */
  cancelsOn: string | null;
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const day = (seconds: unknown) =>
  typeof seconds === "number" ? new Date(seconds * 1000).toISOString().slice(0, 10) : null;

function cardOf(method: unknown): BillingDetails["card"] {
  const card = obj(obj(method).card);
  if (typeof card.last4 !== "string") return null;
  return {
    brand: typeof card.brand === "string" ? card.brand : "card",
    last4: card.last4,
    expMonth: Number(card.exp_month) || 0,
    expYear: Number(card.exp_year) || 0,
  };
}

/**
 * `subscription` : abonnement Stripe avec `default_payment_method` et
 * `customer.invoice_settings.default_payment_method` développés (`expand`).
 */
export function toBillingDetails(subscription: unknown): BillingDetails {
  const sub = obj(subscription);
  const items = obj(sub.items).data;
  const first = obj(Array.isArray(items) ? items[0] : null);
  const periodEnd = day(sub.current_period_end) ?? day(first.current_period_end);
  const cancelAt = day(sub.cancel_at);
  return {
    itemId: typeof first.id === "string" ? first.id : null,
    periodEnd,
    cancelsOn: sub.cancel_at_period_end === true ? (cancelAt ?? periodEnd) : cancelAt,
    card:
      cardOf(sub.default_payment_method) ??
      cardOf(obj(obj(obj(sub.customer).invoice_settings).default_payment_method)),
  };
}

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  cartes_bancaires: "Carte Bancaire",
};

export const brandLabel = (brand: string) => BRANDS[brand] ?? "Carte";

/** `true` si la carte expire avant la fin du mois courant (ou plus tôt). */
export function cardExpired(card: { expMonth: number; expYear: number }, now = new Date()): boolean {
  return card.expYear * 12 + card.expMonth < now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
}
