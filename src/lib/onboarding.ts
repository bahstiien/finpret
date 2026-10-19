import { z } from "zod";
import { dietSchema, equipmentSchema, sessionSchema, slotKeySchema } from "./settings";

/** Données de l'onboarding en 5 étapes (§5). Chaque étape a des défauts sensés et peut être passée. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const onboardingMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    kind: z.enum(["adult", "child"]),
    birthdate: isoDate.nullable().default(null),
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
  diet: dietSchema.pick({ diet: true, allergens: true, refused: true }),
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
export type OnboardingMember = z.infer<typeof onboardingMemberSchema>;

/** Valeurs de départ : 2 adultes, omnivore, tout couvert, dimanche 14 h pendant 3 h, équipement courant. */
export function onboardingDefaults(displayName: string): OnboardingInput {
  return {
    household: {
      name: "",
      members: [
        { name: displayName, kind: "adult", birthdate: null },
        { name: "", kind: "adult", birthdate: null },
      ],
      alternating: { enabled: false, from: null },
    },
    diet: { diet: "omnivore", allergens: [], refused: [] },
    rhythm: { skip: [], weekend: false, absences: [], session: { day: 0, time: "14:00", maxMinutes: 180 } },
    equipment: equipmentSchema.parse({}),
    habits: { shoppingDay: 6, dinnerTime: "17:30", thawTime: "20:30", store: "" },
  };
}
