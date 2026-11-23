import { dayIndex, timeIn, todayIn } from "../lib/dates";

/** Jours restants avant la fin de l'essai, à la date locale du foyer (0 = il se termine aujourd'hui, négatif = échu). */
export function trialDaysLeft(trialEndsAt: string | Date, timeZone: string, now: Date = new Date()): number {
  const today = todayIn(timeZone, now);
  const end = todayIn(timeZone, new Date(trialEndsAt));
  return dayIndex(today, end) - 1;
}

/** Rappels de fin d'essai : à J-3 et J0 (si l'essai court encore), à 10 h (heure du foyer), dans la fenêtre de 15 min du planificateur. */
export const TRIAL_REMINDER_DAYS = [3, 0] as const;
export const TRIAL_REMINDER_HOUR = 10;

export function trialReminderDue(
  trialEndsAt: string | Date,
  timeZone: string,
  now: Date = new Date(),
  windowMin = 15,
): number | null {
  const [hh, mm] = timeIn(timeZone, now).split(":").map(Number) as [number, number];
  if (hh !== TRIAL_REMINDER_HOUR || mm >= windowMin) return null;
  // Essai terminé avant 10 h : « se termine aujourd'hui » arriverait après coup, on ne l'envoie pas.
  if (new Date(trialEndsAt) <= now) return null;
  const days = trialDaysLeft(trialEndsAt, timeZone, now);
  return (TRIAL_REMINDER_DAYS as readonly number[]).includes(days) ? days : null;
}
