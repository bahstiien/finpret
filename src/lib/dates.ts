/** Dates en ISO (AAAA-MM-JJ), calculées dans le fuseau horaire du foyer (§16 Q3 : fuseau par foyer). */

const DAY_MS = 86400000;

/** Date du jour dans un fuseau horaire. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Heure locale « HH:MM » dans un fuseau horaire. */
export function timeIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** 1 = lundi … 7 = dimanche. */
export const isoWeekday = (iso: string) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** Lundi de la semaine qui contient cette date. */
export const mondayOf = (iso: string) => addDays(iso, 1 - isoWeekday(iso));

/** Lundi suivant (le lendemain si c'est dimanche, jour de la session), comme `nextMonday` du prototype. */
export const nextMonday = (iso: string) => addDays(iso, isoWeekday(iso) === 7 ? 1 : 8 - isoWeekday(iso));

/** Jour de la semaine (1 = lundi) d'une date par rapport au lundi `start`, 0 pour le dimanche qui précède. */
export const dayIndex = (start: string, iso: string) =>
  Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / DAY_MS) + 1;

const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
/** « jeudi 15 octobre » */
export const formatLong = (iso: string) => longDate.format(new Date(`${iso}T12:00:00Z`));
/** « 15 octobre » */
export const formatShort = (iso: string) => shortDate.format(new Date(`${iso}T12:00:00Z`));

/** Semaine ISO d'une date : `2027-W01` (le jeudi de la semaine fixe l'année ISO). */
export function isoWeekKey(iso: string): string {
  const thursday = addDays(mondayOf(iso), 3);
  const year = Number(thursday.slice(0, 4));
  const jan4 = `${year}-01-04`;
  const week = Math.floor(dayIndex(mondayOf(jan4), mondayOf(thursday)) / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}
