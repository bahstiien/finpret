/**
 * Séquence de messages de la prise en main (SPEC_PRISE_EN_MAIN §4.5) : règle d'envoi pure.
 * Déclenchée par le comportement et par le calendrier ; au plus un message par jour et par compte ; un message n'est
 * pas envoyé si son étape est déjà faite ; jamais deux fois le même. TypeScript pur (CLAUDE.md, règle 2).
 */
import { addDays, isoWeekday, todayIn } from "@/lib/dates";

export const MESSAGE_KEYS = ["welcome", "shopping_eve", "session_eve", "session_late", "session_after", "week2"] as const;
export type MessageKey = (typeof MESSAGE_KEYS)[number];

/** Ordre de priorité quand plusieurs messages sont dus le même jour (§4.5, règle 1). */
export const PRIORITY: readonly MessageKey[] = [
  "session_eve",
  "shopping_eve",
  "session_late",
  "session_after",
  "week2",
  "welcome",
];

/** Heures locales d'envoi : la veille à 18 h, les autres messages à 10 h. */
export const EVE_MINUTES = 18 * 60;
export const MORNING_MINUTES = 10 * 60;
/** La séquence couvre J0 à J14 ; `session_after` et `week2` peuvent aller jusqu'à `session_done` + 6 jours. */
export const SEQUENCE_DAYS = 14;
export const SESSION_TAIL_DAYS = 6;

export type MessageInput = {
  now: Date;
  /** Fuseau du foyer (`households.timezone`). */
  tz: string;
  /** `welcome` n'est destiné qu'au compte créateur. */
  isCreator: boolean;
  /** Fin de l'onboarding du foyer (« inscription »). */
  signupAt: string;
  /** Jour de session (0 = dimanche … 6 = samedi) et jour de courses (1 = lundi … 7 = dimanche) du foyer. */
  sessionDay: number;
  shoppingDay: number;
  /** Une semaine est préparée (courses et session ont un objet). */
  hasWeek: boolean;
  steps: { shop: boolean; startSession: boolean };
  /** Instant de la fin de la première session, s'il existe. */
  sessionDoneAt: string | null;
  /** Une 2e semaine a été générée. */
  secondWeekGenerated: boolean;
  /** Checklist masquée : coupe `shopping_eve`, `session_late` et `week2` (décision Q7). */
  dismissed: boolean;
  /** Canaux utilisables par ce compte : e-mail (non désinscrit, adresse connue) et Web Push (consenti, appareil). */
  channels: { email: boolean; push: boolean };
  /** Messages déjà envoyés à ce compte, avec leur jour local. */
  sent: Partial<Record<MessageKey, string>>;
};

export type MessagePlan = {
  send: MessageKey | null;
  reason: "ok" | "no_channel" | "one_per_day" | "none_due";
  /** Messages éligibles avant l'arbitrage par priorité (diagnostic, tests). */
  eligible: MessageKey[];
};

const minutesOf = (now: Date, tz: string) => {
  const [h = 0, m = 0] = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .split(":")
    .map(Number);
  return h * 60 + m;
};

const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);

export function planMessage(i: MessageInput): MessagePlan {
  const today = todayIn(i.tz, i.now);
  const minutes = minutesOf(i.now, i.tz);
  const signupDay = todayIn(i.tz, new Date(i.signupAt));
  const sessionDoneDay = i.sessionDoneAt ? todayIn(i.tz, new Date(i.sessionDoneAt)) : null;
  const sessionWeekday = i.sessionDay === 0 ? 7 : i.sessionDay;

  if (!i.channels.email && !i.channels.push) return { send: null, reason: "no_channel", eligible: [] };

  // Fenêtre de la séquence : J0 à J14, prolongée pour les messages rattachés à la session.
  const inSequence = diffDays(today, signupDay) <= SEQUENCE_DAYS;
  const inTail = sessionDoneDay !== null && diffDays(today, sessionDoneDay) <= SESSION_TAIL_DAYS;

  // Un message daté tolère un jour de retard (reporté si un autre est passé avant) ; une veille, jamais : le texte
  // « demain » serait faux.
  const due = (dueDay: string, at: number, lateDays: number) => {
    const late = diffDays(today, dueDay);
    return late >= 0 && late <= lateDays && minutes >= at;
  };

  const eligible: MessageKey[] = [];
  const add = (key: MessageKey, ok: boolean) => {
    if (ok && !i.sent[key]) eligible.push(key);
  };

  add("welcome", i.isCreator && inSequence && diffDays(today, signupDay) <= 1);

  add(
    "shopping_eve",
    inSequence &&
      !i.dismissed &&
      i.hasWeek &&
      !i.steps.shop &&
      isoWeekday(addDays(today, 1)) === i.shoppingDay &&
      minutes >= EVE_MINUTES,
  );

  add(
    "session_eve",
    inSequence &&
      i.hasWeek &&
      !i.steps.startSession &&
      !sessionDoneDay &&
      isoWeekday(addDays(today, 1)) === sessionWeekday &&
      minutes >= EVE_MINUTES,
  );

  // Session prévue il y a 3 jours (ou 4 si le message a été reporté), jamais lancée, après l'inscription.
  const lateSession = [3, 4].map((n) => addDays(today, -n)).find((d) => isoWeekday(d) === sessionWeekday);
  add(
    "session_late",
    inSequence &&
      !i.dismissed &&
      i.hasWeek &&
      !i.steps.startSession &&
      !sessionDoneDay &&
      !!lateSession &&
      diffDays(lateSession, signupDay) >= 0 &&
      due(addDays(lateSession, 3), MORNING_MINUTES, 1),
  );

  add(
    "session_after",
    (inSequence || inTail) && !!sessionDoneDay && due(addDays(sessionDoneDay, 1), MORNING_MINUTES, 1),
  );

  add(
    "week2",
    (inSequence || inTail) &&
      !i.dismissed &&
      !!sessionDoneDay &&
      !i.secondWeekGenerated &&
      due(addDays(sessionDoneDay, 5), MORNING_MINUTES, 1),
  );

  if (!eligible.length) return { send: null, reason: "none_due", eligible };
  // Au plus un message par jour et par compte.
  if (Object.values(i.sent).some((d) => d === today)) return { send: null, reason: "one_per_day", eligible };
  const send = PRIORITY.find((k) => eligible.includes(k)) ?? null;
  return { send, reason: send ? "ok" : "none_due", eligible };
}
