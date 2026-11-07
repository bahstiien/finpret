import { z } from "zod";
import { GOALS } from "@/engine/onboarding";
import { dietSchema, equipmentSchema, sessionSchema, slotKeySchema } from "./settings";

/**
 * Données de l'onboarding (§5, refonte « Montrer la semaine avant de tout demander ») : foyer, envies, restrictions,
 * rythme. Seul le foyer est obligatoire ; le reste a des défauts sensés. L'équipement garde la cuisine standard.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const onboardingMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    kind: z.enum(["adult", "child"]),
    birthdate: isoDate.nullable().default(null),
    /** École de l'association du foyer (SPEC_JANVIER §3 A) et jours de cantine (1 = lundi). */
    schoolId: z.uuid().nullable().default(null),
    canteenDays: z.array(z.number().int().min(1).max(5)).max(5).default([1, 2, 4, 5]),
  })
  .refine((m) => m.kind === "adult" || m.birthdate !== null, { message: "birthdate", path: ["birthdate"] });

export const onboardingSchema = z.object({
  household: z.object({
    name: z.string().trim().min(1).max(60),
    // TODO(spec) §16 Q4 : 10 personnes par foyer au plus (proposition à valider).
    members: z.array(onboardingMemberSchema).min(1).max(10),
    alternating: z
      .object({ enabled: z.boolean(), from: isoDate.nullable() })
      .default({ enabled: false, from: null }),
  }),
  diet: dietSchema.pick({ diet: true, allergens: true, refused: true }).extend({
    /** Objectifs cumulables avec l'alimentation : « sportif », « économique ». */
    goals: z.array(z.enum(GOALS)).max(GOALS.length).default([]),
  }),
  rhythm: z.object({
    /** Créneaux décochés de la grille 5 × 2. */
    skip: z.array(slotKeySchema).default([]),
    weekend: z.boolean().default(false),
    /** Absences par membre (index dans la liste) et par créneau : « Léo : cantine le midi en semaine ». */
    absences: z.array(z.object({ member: z.number().int().min(0), slot: slotKeySchema })).default([]),
    session: sessionSchema.pick({ day: true, time: true, maxMinutes: true }),
  }),
  equipment: equipmentSchema,
  habits: z.object({
    shoppingDay: z.number().int().min(1).max(7).default(6),
    dinnerTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default("17:30"),
    thawTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default("20:30"),
    store: z.string().trim().max(60).default(""),
  }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Valeurs de départ : 1 adulte (le compte), équilibré, tout couvert, dimanche 14 h pendant 3 h, cuisine standard. */
export function onboardingDefaults(displayName: string): OnboardingInput {
  return {
    household: {
      name: "",
      members: [
        { name: displayName, kind: "adult", birthdate: null, schoolId: null, canteenDays: [1, 2, 4, 5] },
      ],
      alternating: { enabled: false, from: null },
    },
    diet: { diet: "omnivore", allergens: [], refused: [], goals: [] },
    rhythm: { skip: [], weekend: false, absences: [], session: { day: 0, time: "14:00", maxMinutes: 180 } },
    equipment: equipmentSchema.parse({}),
    habits: { shoppingDay: 6, dinnerTime: "17:30", thawTime: "20:30", store: "" },
  };
}

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
