/**
 * Planification des notifications (§12) : quels rappels tombent dans la fenêtre du cron (15 min),
 * à l'heure locale du foyer. Pur : l'heure courante et le fuseau sont des entrées.
 */

export type NotificationKind = "dinner" | "thaw" | "shopping" | "session";

export type NotificationPrefs = {
  push: boolean;
  email: boolean;
  dinner: { enabled: boolean; time: string };
  thaw: { enabled: boolean; time: string };
  shoppingReady: boolean;
  sessionStart: boolean;
  consentAt: string | null;
};

export type HouseholdSchedule = {
  /** 0 = dimanche … 6 = samedi (réglage de la session). */
  sessionDay: number;
  sessionTime: string;
  /** 1 = lundi … 7 = dimanche (réglage des courses). */
  shoppingDay: number;
};

/** Heure de l'alerte « Courses : N articles » le jour des courses. TODO(spec) : heure non précisée, 9 h retenu. */
export const SHOPPING_TIME = "09:00";
/** « Ta session commence dans 30 min ». */
export const SESSION_LEAD_MIN = 30;
export const WINDOW_MIN = 15;

const WEEK = 7 * 1440;

export type LocalTime = { date: string; weekday: number; minutes: number };

/** Date, jour (1 = lundi … 7 = dimanche) et minute de la journée dans un fuseau donné. */
export function localTime(now: Date, timeZone: string): LocalTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday!) + 1;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const hm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Minute de la semaine (lundi 0 h = 0). */
const ofWeek = (weekday: number, minutes: number) => ((((weekday - 1) * 1440 + minutes) % WEEK) + WEEK) % WEEK;

/** Le moment `target` (minute de la semaine) est passé depuis moins de `window` minutes. */
const inWindow = (now: number, target: number, window: number) => {
  const delta = (((now - target) % WEEK) + WEEK) % WEEK;
  return delta < window;
};

export type DueNotification = { kind: NotificationKind; /** Jour concerné, clé d'idempotence. */ day: string };

/**
 * Rappels à envoyer maintenant pour un compte. Le jour retenu est la date locale de l'envoi :
 * deux passages du cron dans la même fenêtre donnent la même clé (compte, type, jour).
 */
export function dueNotifications(
  prefs: NotificationPrefs,
  schedule: HouseholdSchedule,
  local: LocalTime,
  window = WINDOW_MIN,
): DueNotification[] {
  if (!prefs.consentAt || (!prefs.push && !prefs.email)) return [];
  const now = ofWeek(local.weekday, local.minutes);
  const daily = (time: string) => inWindow(now, ofWeek(local.weekday, hm(time)), window);
  const due: NotificationKind[] = [];
  if (prefs.dinner.enabled && daily(prefs.dinner.time)) due.push("dinner");
  if (prefs.thaw.enabled && daily(prefs.thaw.time)) due.push("thaw");
  if (prefs.shoppingReady && inWindow(now, ofWeek(schedule.shoppingDay, hm(SHOPPING_TIME)), window)) due.push("shopping");
  if (prefs.sessionStart) {
    const sessionWeekday = schedule.sessionDay === 0 ? 7 : schedule.sessionDay;
    if (inWindow(now, ofWeek(sessionWeekday, hm(schedule.sessionTime) - SESSION_LEAD_MIN), window)) due.push("session");
  }
  return due.map((kind) => ({ kind, day: local.date }));
}

/** Onglet ouvert au clic sur la notification (liens directs, §10). */
export const NOTIFICATION_URL: Record<NotificationKind | "test", string> = {
  dinner: "/app",
  thaw: "/app",
  shopping: "/app/shopping",
  session: "/app/session",
  test: "/app",
};
