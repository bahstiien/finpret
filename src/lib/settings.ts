import { z } from "zod";
import { ALLERGENS } from "@/engine/catalog/allergens";
import { CAKE_TYPES } from "@/engine/catalog/schema";
import { DEFAULT_MENU_SETTINGS, type DietRules, type Equipment, type MenuSettings } from "@/engine/types";

/**
 * Réglages du foyer (§5, §6) : schémas Zod des colonnes JSON de household_settings, avec les défauts
 * de l'onboarding. Partagés par les formulaires, les actions serveur et la génération.
 */

export const SETTINGS_VERSION = 1;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const int = (min: number, max: number) => z.number().int().min(min).max(max);
export const ALLERGEN_KEYS = Object.keys(ALLERGENS) as [
  keyof typeof ALLERGENS,
  ...(keyof typeof ALLERGENS)[],
];
export const DIETS = ["omnivore", "flexitarien", "vegetarien", "pescetarien"] as const;
export const slotKeySchema = z.string().regex(/^[1-7]-(lunch|dinner)$/);

export const dietSchema = z.object({
  diet: z.enum(DIETS).default("omnivore"),
  allergens: z.array(z.enum(ALLERGEN_KEYS)).default([]),
  refused: z.array(z.string().min(1)).default([]),
  /** Objectifs (§6 Alimentation). */
  minVeg: int(0, 5).default(0),
  minProtein: int(0, 60).default(0),
});

export const menuSchema = z.object({
  proteinCaps: z
    .object({
      volaille: int(0, 5),
      boeuf: int(0, 5),
      porc: int(0, 5),
      poisson: int(0, 5),
      veg: int(0, 5),
    })
    .default(DEFAULT_MENU_SETTINGS.proteinCaps),
  pasta: int(1, 2).default(2),
  ovenMax: int(0, 5).default(2),
  light: int(0, 4).default(2),
  world: int(0, 3).default(2),
  comfort: z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(2)]).default(1),
  bankUse: int(0, 4).default(2),
  noRepeatWeeks: int(2, 6).default(3),
  /** Créneaux décochés de la grille « Repas à prévoir », mémorisés pour les semaines suivantes. */
  skip: z.array(slotKeySchema).default([]),
  /** Week-end proposé dans la grille (option de l'onboarding). */
  weekend: z.boolean().default(false),
  cake: z
    .object({
      enabled: z.boolean(),
      day: int(1, 7),
      types: z.array(z.enum(CAKE_TYPES)).min(1),
    })
    .default({ enabled: true, day: 3, types: [...CAKE_TYPES] }),
});

export const SESSION_LEVELS = ["beginner", "confident"] as const;
export const sessionSchema = z.object({
  /** 0 = dimanche … 6 = samedi (jour de la session, la veille du lundi par défaut). */
  day: int(0, 6).default(0),
  time: hhmm.default("14:00"),
  maxMinutes: int(60, 360).default(180),
  level: z.enum(SESSION_LEVELS).default("confident"),
  sound: z.boolean().default(true),
  vibration: z.boolean().default(true),
});

export const equipmentSchema = z.object({
  ovenRacks: int(0, 4).default(2),
  burners: int(1, 6).default(4),
  airfryer: z.boolean().default(false),
  microwave: z.boolean().default(true),
  standMixer: z.boolean().default(false),
  blender: z.boolean().default(false),
  mixer: z.boolean().default(false),
  pressureCooker: z.boolean().default(false),
  freezer: z.boolean().default(true),
});

export const shoppingSchema = z.object({
  /** Ordre des rayons (clés) ; vide = ordre du catalogue. */
  aisleOrder: z.array(z.string()).default([]),
  recurring: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  /** Ingrédients du placard à vérifier chaque semaine. */
  baseChecks: z.array(z.string()).default([]),
  exportFormat: z.enum(["text", "checklist"]).default("text"),
  /** 1 = lundi … 7 = dimanche. */
  shoppingDay: int(1, 7).default(6),
  store: z.string().trim().max(60).default(""),
});

/** Cantine (§6, §13) : alerte doublon et lien des menus par enfant. Les jours de cantine viennent de la présence. */
export const canteenSchema = z.object({
  alert: z.boolean().default(true),
  /** Lien du menu publié (PDF de la mairie…), par enfant. */
  urls: z.record(z.string(), z.url().max(2000)).default({}),
});

export const notificationsSchema = z.object({
  push: z.boolean().default(false),
  email: z.boolean().default(false),
  dinner: z.object({ enabled: z.boolean(), time: hhmm }).default({ enabled: true, time: "17:30" }),
  thaw: z.object({ enabled: z.boolean(), time: hhmm }).default({ enabled: true, time: "20:30" }),
  shoppingReady: z.boolean().default(true),
  sessionStart: z.boolean().default(true),
  /** Date du consentement explicite aux notifications (RGPD). */
  consentAt: z.string().nullable().default(null),
});

export type DietSettings = z.infer<typeof dietSchema>;
export type MenuSettingsForm = z.infer<typeof menuSchema>;
export type SessionSettings = z.infer<typeof sessionSchema>;
export type EquipmentSettings = z.infer<typeof equipmentSchema>;
export type ShoppingSettings = z.infer<typeof shoppingSchema>;
export type NotificationSettings = z.infer<typeof notificationsSchema>;
export type CanteenSettings = z.infer<typeof canteenSchema>;

export type HouseholdSettings = {
  diet: DietSettings;
  menu: MenuSettingsForm;
  session: SessionSettings;
  shopping: ShoppingSettings;
  equipment: EquipmentSettings;
  canteen: CanteenSettings;
};

export const SETTINGS_SCHEMAS = {
  diet: dietSchema,
  menu: menuSchema,
  session: sessionSchema,
  shopping: shoppingSchema,
  equipment: equipmentSchema,
  canteen: canteenSchema,
} as const;

export function defaultSettings(): HouseholdSettings {
  return {
    diet: dietSchema.parse({}),
    menu: menuSchema.parse({}),
    session: sessionSchema.parse({}),
    shopping: shoppingSchema.parse({}),
    equipment: equipmentSchema.parse({}),
    canteen: canteenSchema.parse({}),
  };
}

/** Lit les réglages enregistrés en complétant les champs manquants par les défauts (schéma versionné). */
export function parseSettings(
  row: Partial<Record<keyof HouseholdSettings, unknown>> | null,
): HouseholdSettings {
  const d = defaultSettings();
  const read = <K extends keyof HouseholdSettings>(k: K): HouseholdSettings[K] => {
    const res = SETTINGS_SCHEMAS[k].safeParse(row?.[k] ?? {});
    return (res.success ? res.data : d[k]) as HouseholdSettings[K];
  };
  return {
    diet: read("diet"),
    menu: read("menu"),
    session: read("session"),
    shopping: read("shopping"),
    equipment: read("equipment"),
    canteen: read("canteen"),
  };
}

/** Réglages du moteur à partir des réglages du foyer. */
export function toMenuSettings(s: HouseholdSettings): MenuSettings {
  return {
    proteinCaps: s.menu.proteinCaps,
    ovenMax: s.menu.ovenMax,
    pasta: s.menu.pasta,
    light: s.menu.light,
    world: s.menu.world,
    comfort: s.menu.comfort,
    bankUse: s.equipment.freezer ? s.menu.bankUse : 0,
    noRepeatWeeks: s.menu.noRepeatWeeks,
    skip: s.menu.skip,
    cake: s.menu.cake.enabled,
    minVeg: s.diet.minVeg,
  };
}

export function toDietRules(s: HouseholdSettings): DietRules {
  return {
    diet: s.diet.diet,
    allergens: s.diet.allergens,
    refused: s.diet.refused,
    minProtein: s.diet.minProtein,
  };
}

export function toEquipment(s: HouseholdSettings): Equipment {
  return { ...s.equipment };
}
