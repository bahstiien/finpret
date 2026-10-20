/** Événements d'indicateurs (SPEC_JANVIER §1) : nom, et propriétés attendues, enregistrés dans la table `events`. */
export const EVENT_NAMES = [
  "signup",
  "onboarding_done",
  "week_generated",
  "session_started",
  "session_done",
  "shopping_checked",
  "trial_started",
  "subscribed",
  "association_joined",
  // Acquisition des associations (SPEC_JANVIER §8 bis A).
  "asso_landing_view",
  "asso_simulator_used",
  "asso_lead_submitted",
  "asso_signup_started",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Événements enregistrés une seule fois par compte (les autres le sont à chaque occurrence ou par semaine). */
export const ONCE_PER_USER: readonly EventName[] = ["signup", "onboarding_done", "trial_started"];

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);
}
