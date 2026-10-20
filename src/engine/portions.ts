import type { Guests, Meal, WeekPlan } from "./types";

/** Portions (§7.4) : port de kidF, defaultGuests, guestsOf, mealPd, à partir des membres et de leur présence. */

export type Member = {
  id: string;
  name: string;
  kind: "adult" | "child";
  birthdate?: string | null;
  portionOverride?: number | null;
  archived?: boolean;
};

export type PresenceRule = {
  memberId: string;
  weekday: number;
  meal: Meal;
  present: boolean;
  weekParity: "all" | "A" | "B";
};

/** Âge en années révolues à une date ISO. */
export function ageOn(birthdate: string, onDate: string): number {
  const [by, bm, bd] = birthdate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = onDate.split("-").map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Portion selon l'âge : moins de 3 ans 0,33 ; 3 à 6 ans 0,5 ; 7 à 11 ans 0,75 ; 12 ans et plus 1. */
export function portionForAge(age: number): number {
  if (age < 3) return 0.33;
  if (age <= 6) return 0.5;
  if (age <= 11) return 0.75;
  return 1;
}

/** Portion d'un membre : modifiable ; adulte 1 ; enfant selon l'âge (0,5 si la date de naissance manque). */
export function memberPortion(member: Member, onDate: string): number {
  if (member.portionOverride != null) return member.portionOverride;
  if (member.kind === "adult") return 1;
  return member.birthdate ? portionForAge(ageOn(member.birthdate, onDate)) : 0.5;
}

/** Comment compter les portions d'un repas : présents par défaut, et portion d'un enfant ajouté à la main. */
export type PortionModel = {
  /** Personnes présentes par défaut à un créneau (règles de présence). */
  counts(day: number, meal: Meal): Guests;
  /** Portions par défaut d'un créneau. */
  base(day: number, meal: Meal): number;
  /** Portion d'un enfant ajouté dans « Qui est à table ? ». */
  childFactor: number;
};

/** Semaine A ou B de la garde alternée, comptée depuis une semaine de départ « A ». */
export function weekParity(weekStart: string, alternatingFrom?: string | null): "A" | "B" | null {
  if (!alternatingFrom) return null;
  const weeks = Math.round(
    (Date.parse(`${weekStart}T12:00:00Z`) - Date.parse(`${alternatingFrom}T12:00:00Z`)) / 604800000,
  );
  return ((weeks % 2) + 2) % 2 === 0 ? "A" : "B";
}

/** Présence d'un membre à un repas (règle de la semaine A ou B, sinon « toutes les semaines », sinon présent). */
export function isPresentAt(
  presence: readonly PresenceRule[],
  memberId: string,
  day: number,
  meal: Meal,
  parity: "A" | "B" | null,
): boolean {
  const rules = presence.filter((r) => r.memberId === memberId && r.weekday === day && r.meal === meal);
  const rule = (parity && rules.find((r) => r.weekParity === parity)) || rules.find((r) => r.weekParity === "all");
  return rule ? rule.present : true;
}

export function householdPortions(options: {
  members: readonly Member[];
  presence: readonly PresenceRule[];
  weekStart: string;
  alternatingFrom?: string | null;
}): PortionModel {
  const parity = weekParity(options.weekStart, options.alternatingFrom);
  const active = options.members.filter((m) => !m.archived);
  const isPresent = (m: Member, day: number, meal: Meal) => isPresentAt(options.presence, m.id, day, meal, parity);
  const portion = (m: Member) => memberPortion(m, options.weekStart);
  const children = active.filter((m) => m.kind === "child");
  return {
    counts: (day, meal) => {
      const here = active.filter((m) => isPresent(m, day, meal));
      return {
        a: here.filter((m) => m.kind === "adult").length,
        c: here.filter((m) => m.kind === "child").length,
      };
    },
    base: (day, meal) => active.filter((m) => isPresent(m, day, meal)).reduce((s, m) => s + portion(m), 0),
    childFactor: children.length ? children.reduce((s, m) => s + portion(m), 0) / children.length : 0.5,
  };
}

/**
 * Modèle du prototype : 2 adultes, et l'enfant le soir et le week-end (cantine le midi en semaine).
 * Sert aux tests de fidélité.
 */
export function legacyPortions(kid = 0.5): PortionModel {
  const withChild = (day: number, meal: Meal) => meal === "dinner" || day >= 6;
  return {
    counts: (day, meal) => ({ a: 2, c: withChild(day, meal) ? 1 : 0 }),
    base: (day, meal) => (withChild(day, meal) ? 2 + kid : 2),
    childFactor: kid,
  };
}

export const guestsOf = (w: Pick<WeekPlan, "guests">, day: number, meal: Meal): Guests | null =>
  w.guests?.[`${day}-${meal}`] ?? null;

/** Portions d'un repas : convives du créneau s'ils sont précisés, sinon les présents par défaut. */
export function mealPd(w: Pick<WeekPlan, "guests">, pm: PortionModel, day: number, meal: Meal): number {
  const g = guestsOf(w, day, meal);
  return g ? g.a + g.c * pm.childFactor : pm.base(day, meal);
}
