import { timeIn, todayIn } from "../lib/dates";
import { trialDaysLeft } from "./trial";

/**
 * Rappel de reconduction de l'abonnement annuel (art. L215-1 du Code de la consommation) : l'information doit
 * partir « au plus tôt trois mois et au plus tard un mois » avant le terme. On l'envoie dès qu'on entre dans la
 * fenêtre [J-60, J-31], à partir de 10 h (heure du foyer) : un passage manqué du planificateur est rattrapé au
 * suivant, et l'envoi reste unique par échéance (clé = date de reconduction).
 */
export const RENEWAL_NOTICE_MAX_DAYS = 60;
export const RENEWAL_NOTICE_MIN_DAYS = 31;
export const RENEWAL_NOTICE_HOUR = 10;

export function renewalNoticeDue(
  periodEnd: string | Date,
  timeZone: string,
  now: Date = new Date(),
): { days: number; renewalDay: string } | null {
  const [hh] = timeIn(timeZone, now).split(":").map(Number) as [number, number];
  if (hh < RENEWAL_NOTICE_HOUR) return null;
  const days = trialDaysLeft(periodEnd, timeZone, now);
  if (days < RENEWAL_NOTICE_MIN_DAYS || days > RENEWAL_NOTICE_MAX_DAYS) return null;
  return { days, renewalDay: todayIn(timeZone, new Date(periodEnd)) };
}

/** Prix de reconduction de l'annuel, en centimes (prix Stripe `STRIPE_PRICE_YEARLY`, coupon association non reconduit). */
export const YEARLY_PRICE_CENTS = 4999;
