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
  // Compteurs d'offre et quotas (SPEC_JANVIER §4, §5).
  "menu_swap",
  "canteen_pdf_import",
  // Acquisition des associations (SPEC_JANVIER §8 bis A).
  "asso_landing_view",
  "asso_simulator_used",
  "asso_lead_submitted",
  "asso_signup_started",
  // Progrès : série et passeport (SPEC_PROGRES §7).
  "streak_week_closed",
  "streak_pause_planned",
  "streak_pause_cancelled",
  "streak_milestone",
  "share_card_created",
  "stamp_earned",
  "progress_viewed",
  "empty_stamp_tapped",
  "progress_hidden",
  "progress_shown",
  // Courses réelles (indicateurs : aucun libellé libre, aucun détail alimentaire).
  "purchase_recorded",
  "purchase_quantity_corrected",
  "shopping_issue_reported",
  "adaptation_previewed",
  "adaptation_no_verified_candidate",
  "adaptation_committed",
  "adaptation_undone",
  "adaptation_conflict",
  "shopping_review_completed",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Événements enregistrés une seule fois par compte (les autres le sont à chaque occurrence ou par semaine). */
export const ONCE_PER_USER: readonly EventName[] = ["signup", "onboarding_done", "trial_started"];

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);
}
