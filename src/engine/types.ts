import type { Cake, Ingredient, Main, Pack, Protein, Simple, Soup } from "./catalog/schema";

/** Types partagés du moteur (SPEC §7). Le plan de semaine reprend la structure du prototype (§9, `weeks.plan`). */

export type Meal = "lunch" | "dinner";
export type Slot = { day: number; meal: Meal };
/** Clé d'un créneau : « 3-dinner » (1 = lundi … 7 = dimanche). */
export type SlotKey = `${number}-${Meal}`;
export const slotKey = (day: number, meal: Meal): SlotKey => `${day}-${meal}`;

export type Recipe = Main | Soup | Simple;
export type AnyRecipe = Main | Soup | Simple;
/** Recette après fusion de sa variante de saison (`resolve`). */
export type Resolved<R> = R & { svl?: string };

/** Catalogue utilisé par le moteur : le seed, ou le catalogue global plus les recettes du foyer. */
export type Library = {
  mains: Main[];
  soups: Soup[];
  simples: Simple[];
  cakes: Cake[];
  ingredients: Record<string, Ingredient>;
  packs: Record<string, Pack>;
  notSeasonal: string[];
  /** Ordre des rayons (clé, libellé) ; « base » (placard) vient après. */
  aisles: [string, string][];
};

/** Garde-manger : quantité en stock, ou null pour « assez ». Un ingrédient absent n'est pas en stock. */
export type Pantry = Record<string, number | null>;
export type Ratings = Record<string, 1 | -1>;
/** Réserve du congélateur : nombre de repas par recette, avec la date de congélation (la plus ancienne sert en premier). */
export type BankEntry = { recipeId: string; portions: number; frozenAt: string };

export type ComfortSetting = 0 | 0.5 | 1 | 2;

/** Réglages de la section Menu (§6). Les défauts reproduisent le prototype. */
export type MenuSettings = {
  proteinCaps: Record<Protein, number>;
  ovenMax: number;
  /** Minimum de plats de pâtes (1 à 2). */
  pasta: number;
  /** Soirs légers (0 à 4) : les 2 premiers en soupe, les suivants en soirs simples. */
  light: number;
  /** Recettes du monde minimum (0 à 3). */
  world: number;
  /** Plats réconfort : jamais (0), 1 toutes les 2 semaines (0.5), 1, 2. */
  comfort: ComfortSetting;
  /** Repas tirés du congélateur (0 à 4). */
  bankUse: number;
  /** Période sans répétition, en semaines (2 à 6). */
  noRepeatWeeks: number;
  /** Créneaux décochés de la grille « Repas à prévoir », mémorisés d'une semaine à l'autre. */
  skip: string[];
  /** Goûter de la semaine. */
  cake: boolean;
  /** Objectif « minimum de repas végétariens » parmi les plats de batch (0 = règle du prototype : 1 dès 4 plats). */
  minVeg: number;
};

export const DEFAULT_MENU_SETTINGS: MenuSettings = {
  proteinCaps: { volaille: 2, boeuf: 1, porc: 1, poisson: 1, veg: 2 },
  ovenMax: 2,
  pasta: 2,
  light: 2,
  world: 2,
  comfort: 1,
  bankUse: 2,
  noRepeatWeeks: 3,
  skip: [],
  cake: true,
  minVeg: 0,
};

export type Diet = "omnivore" | "flexitarien" | "vegetarien" | "pescetarien";

/** Filtre dur, appliqué avant tout le reste et jamais relâché (§7.3, point 7). */
export type DietRules = {
  diet: Diet;
  /** Allergènes exclus (clés de ALLERGENS). */
  allergens: string[];
  /** Ingrédients refusés. */
  refused: string[];
  /** Objectif « protéines minimales par repas » (g par portion adulte), pour les repas. */
  minProtein?: number;
};

export const NO_DIET_RULES: DietRules = { diet: "omnivore", allergens: [], refused: [] };

export type Guests = { a: number; c: number };

/** Plan d'une semaine (§9, `weeks.plan`). */
export type WeekPlan = {
  start: string;
  groups: { meals: Slot[]; id: string }[];
  soup: { days: number[]; id: string } | null;
  simples: { day: number; id: string }[];
  bank: (Slot & { id: string })[];
  /** Index des plats doublés pour la réserve du congélateur. */
  doubles: number[];
  banked: boolean;
  removed: string[];
  skip: string[];
  cake: string;
  /** Plats réconfort parmi les plats de batch (cm) et parmi les soirs simples (cs). */
  cm: number;
  cs: number;
  /** Minimum de pâtes effectivement retenu (abaissé en dernier recours). */
  pastaNeed: number;
  weekend?: Record<string, string>;
  guests?: Record<string, Guests>;
  locked?: string[];
  pantryDone?: boolean;
  /** Repas de la réserve déjà décomptés du congélateur (clôture de la semaine). */
  bankConsumed?: boolean;
};

export type Equipment = {
  ovenRacks: number;
  burners: number;
  airfryer: boolean;
  microwave: boolean;
  blender: boolean;
  mixer: boolean;
  standMixer: boolean;
  pressureCooker: boolean;
  freezer: boolean;
};

/** Équipement du prototype (et défauts de l'onboarding, §5). */
export const DEFAULT_EQUIPMENT: Equipment = {
  ovenRacks: 2,
  burners: 4,
  airfryer: true,
  microwave: true,
  blender: true,
  mixer: true,
  standMixer: true,
  pressureCooker: false,
  freezer: true,
};

export type SessionLevel = "beginner" | "confident";
