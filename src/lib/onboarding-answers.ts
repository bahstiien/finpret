/**
 * Réponses de l'onboarding converties en réglages (créneaux, absences, moment de session), sans zod : ces fonctions
 * servent aussi dans les composants client de l'onboarding, et le schéma de validation reste côté serveur.
 */
/** Réponse aux questions « Vous déjeunez / dînez à la maison en semaine ? ». */
export type MealAnswer = "oui" | "certains" | "non";
const WEEKDAYS = [1, 2, 3, 4, 5] as const;

/** Créneaux de la semaine à ne pas prévoir, d'après les réponses midi et soir (jours retenus pour « Certains jours »). */
export function skipFromAnswers(answers: {
  lunch: MealAnswer;
  lunchDays: readonly number[];
  dinner: MealAnswer;
  dinnerDays: readonly number[];
}): string[] {
  const off = (answer: MealAnswer, days: readonly number[]) =>
    WEEKDAYS.filter((d) => answer === "non" || (answer === "certains" && !days.includes(d)));
  return [
    ...off(answers.lunch, answers.lunchDays).map((d) => `${d}-lunch`),
    ...off(answers.dinner, answers.dinnerDays).map((d) => `${d}-dinner`),
  ];
}

/** Absences de la semaine : un membre « pas là le midi » l'est du lundi au vendredi. */
export function absencesFrom(away: readonly { lunch: boolean; dinner: boolean }[]) {
  return away.flatMap((a, member) =>
    (["lunch", "dinner"] as const)
      .filter((meal) => a[meal])
      .flatMap((meal) => WEEKDAYS.map((d) => ({ member, slot: `${d}-${meal}` }))),
  );
}

/** Repas prévus : les 10 créneaux de la semaine moins ceux décochés, plus les 4 du week-end s'il est prévu. */
export const plannedMeals = (skip: readonly string[], weekend: boolean) =>
  10 - skip.filter((k) => /^[1-5]-/.test(k)).length + (weekend ? 4 : 0);

/** Moments de session proposés (jour : 0 = dimanche, comme `session.day`). */
export const SESSION_MOMENTS = {
  dimanche: { day: 0, time: "14:00" },
  samedi: { day: 6, time: "09:30" },
  soir: { day: 3, time: "19:00" },
} as const;
export type SessionMoment = keyof typeof SESSION_MOMENTS;
