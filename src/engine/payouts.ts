/**
 * Reversements aux associations (SPEC_JANVIER §5, D10) : règles de calcul pures, sans accès à la base.
 *  - abonnement annuel payé (première année ou renouvellement) : +800 centimes ;
 *  - mois d'abonnement mensuel payé : +50 centimes ;
 *  - remboursement ou litige sur une facture déjà comptée : ligne négative du même montant.
 * Clôture trimestrielle : somme par association ; au moins 2 000 centimes → versement, sinon report.
 */

export const YEARLY_CENTS = 800;
export const MONTHLY_CENTS = 50;
export const MIN_PAYOUT_CENTS = 2000;

export type LineKind = "yearly" | "monthly" | "refund";

/** Ligne de reversement d'une facture payée, ou null (offre inconnue, facture à 0 €). */
export function lineForInvoice(
  plan: "monthly" | "yearly" | null,
  amountPaidCents: number,
): { kind: LineKind; amount: number } | null {
  if (!plan || amountPaidCents <= 0) return null;
  return plan === "yearly"
    ? { kind: "yearly", amount: YEARLY_CENTS }
    : { kind: "monthly", amount: MONTHLY_CENTS };
}

/** Ligne négative qui annule une ligne déjà comptée. */
export function refundLine(counted: { amount_cents: number }): { kind: LineKind; amount: number } {
  return { kind: "refund", amount: -counted.amount_cents };
}

/** Trimestre civil d'une date : `2027-T1` (janvier à mars). */
export function quarterOf(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return `${iso.slice(0, 4)}-T${Math.ceil(month / 3)}`;
}

/** Trimestre qui précède celui de `iso` (clôturé le 1er jour du trimestre suivant). */
export function previousQuarter(iso: string): string {
  const [year, q] = quarterOf(iso).split("-T").map(Number) as [number, number];
  return q === 1 ? `${year - 1}-T4` : `${year}-T${q - 1}`;
}

/** Premier jour du trimestre et premier jour du suivant (bornes `[début, fin[`). */
export function quarterBounds(quarter: string): { start: string; end: string } {
  const [year, q] = quarter.split("-T").map(Number) as [number, number];
  const month = (q - 1) * 3 + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = q === 4 ? `${year + 1}-01-01` : `${year}-${String(month + 3).padStart(2, "0")}-01`;
  return { start, end };
}

export type PayoutDecision = { status: "ready" | "carried_over"; amount: number };

/** Décision de clôture pour le total d'une association. Un total négatif ou insuffisant est reporté. */
export function decidePayout(totalCents: number): PayoutDecision {
  return { status: totalCents >= MIN_PAYOUT_CENTS ? "ready" : "carried_over", amount: totalCents };
}
