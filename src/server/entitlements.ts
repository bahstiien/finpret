/**
 * Offre gratuite et offre payante (SPEC_JANVIER §4) : fonction unique `can(household, feature)`.
 * Pure (aucun accès à la base) : les actions serveur et l'interface l'appellent avec l'état d'abonnement du foyer,
 * jamais l'inverse. Le serveur reste l'autorité : l'interface ne sert qu'à masquer ce qui serait refusé.
 */

export type Plan = "trial" | "monthly" | "yearly" | "free";

/** État d'abonnement d'un foyer (table `subscriptions`) et rattachement à une association approuvée. */
export type HouseholdOffer = {
  plan: Plan;
  /** Statut Stripe, ou `trialing` pour l'essai géré par l'application. */
  status: string;
  trialEndsAt: string | Date | null;
  /** `households.association_id` : renseigné uniquement si l'association est `approved` (SPEC_JANVIER §3 A). */
  associationId: string | null;
};

export type Feature =
  | "menu.generate"
  | "shopping"
  | "purchases"
  | "session"
  | "discover"
  | "progress"
  | "menu.swap"
  | "menu.move"
  | "menu.guests"
  | "pantry"
  | "notifications.meals"
  | "print"
  | "canteen"
  | "canteen.alert"
  | "household.members";

/** Offre effective : l'essai se périme tout seul, un abonnement résilié ou impayé définitivement est gratuit. */
export type Tier = "free" | "trial" | "subscribed";

export const FREE_SWAPS_PER_WEEK = 3;
export const MEMBER_LIMIT: Record<Tier, number> = { free: 2, trial: 8, subscribed: 8 };

const SUBSCRIBED_STATUSES = new Set(["active", "trialing", "past_due"]);

export function tierOf(offer: HouseholdOffer, now: Date = new Date()): Tier {
  if (offer.plan === "monthly" || offer.plan === "yearly") {
    return SUBSCRIBED_STATUSES.has(offer.status) ? "subscribed" : "free";
  }
  if (offer.plan === "trial" && offer.trialEndsAt && new Date(offer.trialEndsAt) > now) return "trial";
  return "free";
}

/** « purchases » : corriger ses achats réels reste gratuit (D-01), sans consommer le quota de changements (D-02). */
const ALWAYS: readonly Feature[] = ["menu.generate", "shopping", "purchases", "session", "discover", "progress"];
const PAID_ONLY: readonly Feature[] = ["menu.move", "menu.guests", "pantry", "notifications.meals", "print"];
/** D12 : cantine et alerte doublon gratuites pour les foyers rattachés à une association. */
const ASSOCIATION_FREE: readonly Feature[] = ["canteen", "canteen.alert"];

export type CanContext = {
  now?: Date;
  /** `menu.swap` : changements déjà faits cette semaine. `household.members` : comptes déjà dans le foyer. */
  used?: number;
};

export function can(offer: HouseholdOffer, feature: Feature, ctx: CanContext = {}): boolean {
  const tier = tierOf(offer, ctx.now);
  const paid = tier !== "free";
  if (ALWAYS.includes(feature)) return true;
  if (PAID_ONLY.includes(feature)) return paid;
  if (ASSOCIATION_FREE.includes(feature)) return paid || offer.associationId !== null;
  if (feature === "menu.swap") return paid || (ctx.used ?? 0) < FREE_SWAPS_PER_WEEK;
  if (feature === "household.members") return (ctx.used ?? 0) < MEMBER_LIMIT[tier];
  return false;
}
