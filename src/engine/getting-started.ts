/**
 * Prise en main (SPEC_PRISE_EN_MAIN §4.1, §4.2) : état de la checklist « Ta première semaine » et choix des conseils.
 * TypeScript pur : aucune dépendance à React ni à Supabase (CLAUDE.md, règle 2).
 */

export const STEPS = ["discover_menu", "adjust_meal", "invite", "shop", "start_session", "finish_session"] as const;
export type StepKey = (typeof STEPS)[number];

/** Étapes obligatoires : l'invitation est facultative et ne bloque pas la fin. */
export const REQUIRED_STEPS: readonly StepKey[] = [
  "discover_menu",
  "adjust_meal",
  "shop",
  "start_session",
  "finish_session",
];

/** Événements qui cochent une étape (SPEC_PRISE_EN_MAIN §4.1). */
export const STEP_EVENTS: Partial<Record<StepKey, readonly string[]>> = {
  adjust_meal: ["menu_swap", "menu_move", "menu_removed"],
  invite: ["invitation_sent"],
  shop: ["shopping_checked"],
  start_session: ["session_started"],
  finish_session: ["session_done"],
};

/** Noms d'événements à lire pour calculer la checklist. */
export const CHECKLIST_EVENT_NAMES: readonly string[] = Object.values(STEP_EVENTS).flat();

export const SUCCESS_VISIBLE_DAYS = 3;
export const AUTO_COLLAPSE_DAYS = 21;
const DAY_MS = 86_400_000;

export type EventRow = { name: string; householdId: string | null; userId: string | null; at: string };
export type SavedStep = { done_at: string; by: string | null; via: "event" | "solo" };
export type SavedSteps = Partial<Record<StepKey, SavedStep>>;

export type ChecklistInput = {
  now: Date;
  householdId: string;
  createdAt: string;
  /** Événements du foyer (ceux d'un autre foyer sont ignorés). */
  events: readonly EventRow[];
  /** Comptes dans le foyer (`memberships`). */
  accountCount: number;
  saved: SavedSteps;
  dismissedAt: string | null;
  completedAt: string | null;
};

export type StepState = { done: boolean; doneAt: string | null; by: string | null; via: "event" | "solo" | null };
export type CardMode = "card" | "success" | "hidden";

export type ChecklistState = {
  steps: Record<StepKey, StepState>;
  doneCount: number;
  total: number;
  completed: boolean;
  completedAt: string | null;
  /** Première étape obligatoire non faite : porte le bouton principal. */
  next: StepKey | null;
  mode: CardMode;
  /** Réduite d'office après 21 jours sans être terminée. */
  autoCollapsed: boolean;
};

const earliest = (rows: readonly EventRow[]) =>
  rows.reduce<EventRow | null>((a, r) => (!a || r.at < a.at ? r : a), null);

/** Étapes nouvellement cochées par rapport à l'état enregistré (à inscrire et à journaliser). */
export function newlyDone(saved: SavedSteps, state: ChecklistState): StepKey[] {
  return STEPS.filter((s) => state.steps[s].done && !saved[s]);
}

export function computeChecklist(input: ChecklistInput): ChecklistState {
  const mine = input.events.filter((e) => e.householdId === input.householdId);
  const steps = {} as Record<StepKey, StepState>;
  for (const key of STEPS) {
    // Une étape cochée le reste (monotonie), même si l'événement disparaît.
    const saved = input.saved[key];
    if (saved) {
      steps[key] = { done: true, doneAt: saved.done_at, by: saved.by, via: saved.via };
      continue;
    }
    const hit = earliest(mine.filter((e) => STEP_EVENTS[key]?.includes(e.name)));
    if (key === "discover_menu") {
      steps[key] = { done: true, doneAt: input.createdAt, by: null, via: "event" };
    } else if (hit) {
      steps[key] = { done: true, doneAt: hit.at, by: hit.userId, via: "event" };
    } else if (key === "invite" && input.accountCount >= 2) {
      steps[key] = { done: true, doneAt: input.now.toISOString(), by: null, via: "event" };
    } else {
      steps[key] = { done: false, doneAt: null, by: null, via: null };
    }
  }
  const doneCount = STEPS.filter((s) => steps[s].done).length;
  const completed = REQUIRED_STEPS.every((s) => steps[s].done);
  const completedAt = input.completedAt ?? (completed ? input.now.toISOString() : null);
  const next = REQUIRED_STEPS.find((s) => !steps[s].done) ?? null;
  const age = (iso: string) => (input.now.getTime() - new Date(iso).getTime()) / DAY_MS;

  let mode: CardMode = "card";
  if (input.dismissedAt) mode = "hidden";
  else if (completed) mode = completedAt && age(completedAt) < SUCCESS_VISIBLE_DAYS ? "success" : "hidden";

  return {
    steps,
    doneCount,
    total: STEPS.length,
    completed,
    completedAt,
    next,
    mode,
    autoCollapsed: !completed && age(input.createdAt) >= AUTO_COLLAPSE_DAYS,
  };
}

/** Étape « Inviter » validée par « Je cuisine seul·e » (SPEC_PRISE_EN_MAIN §4.1). */
export function withSolo(saved: SavedSteps, userId: string | null, now: Date): SavedSteps {
  if (saved.invite) return saved;
  return { ...saved, invite: { done_at: now.toISOString(), by: userId, via: "solo" } };
}

// --- Conseils contextuels (bulles) --------------------------------------------------------------

export const TIP_KEYS = ["menu", "shopping", "stock", "session", "discover"] as const;
export type TipKey = (typeof TIP_KEYS)[number];
export const MAX_TIPS_PER_DAY = 2;

/** Conseils de la première session (SPEC_PRISE_EN_MAIN §4.4.4) : hors limite des 2 bulles par jour. */
export const FIRST_SESSION_TIPS = ["fs_wake", "fs_timers", "fs_next"] as const;
export type FirstSessionTip = (typeof FIRST_SESSION_TIPS)[number];

export type TipInput = {
  tab: TipKey;
  /** `tips_seen` du compte. */
  seen: readonly string[];
  /** Bulles déjà affichées aujourd'hui à ce compte (jour local du foyer). */
  shownToday: number;
  /** Une aide transitoire est déjà à l'écran (Sheet ouverte, conseil de première session). */
  otherTransient: boolean;
  /** `can('pantry')` : la bulle Stock ne promeut pas une fonction verrouillée. */
  canPantry: boolean;
};

/** Clé de la bulle à afficher sur l'onglet, ou null (une par écran, 2 par jour, jamais sur une fonction verrouillée). */
export function tipFor(input: TipInput): TipKey | null {
  if (input.otherTransient || input.shownToday >= MAX_TIPS_PER_DAY) return null;
  if (input.seen.includes(input.tab)) return null;
  if (input.tab === "stock" && !input.canPantry) return null;
  return input.tab;
}
