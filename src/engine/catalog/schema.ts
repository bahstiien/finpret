import { z } from "zod";

/** Schémas des fichiers `seed/*.json` (format décrit dans seed/README.md). Stricts : un champ inconnu est une erreur. */

export const UNITS = ["g", "ml", "pc", "boite", "cs", "cc"] as const;
export const PROTEINS = ["volaille", "boeuf", "porc", "poisson", "veg"] as const;
export const COOK_MODES = ["feu", "four", "airfryer", "micro", "blender", "mixeur", "robot", "plan"] as const;
export const CAKE_TYPES = ["gateau", "brioche", "biscuit", "crepe"] as const;

export type Unit = (typeof UNITS)[number];
export type Protein = (typeof PROTEINS)[number];

const month = z.number().int().min(1).max(12);
const months = z.array(month).min(1);
/** `{ [clé ingrédient]: quantité pour 4 portions adultes }` */
const ingredientQuantities = z.record(z.string(), z.number().positive());
/** Macros par portion adulte : [kcal, protéines g, glucides g, lipides g]. */
const macros4 = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const country = z.string().regex(/^[a-z]{2}$/);

export const ingredientSchema = z
  .object({
    l: z.string().min(1),
    u: z.enum(UNITS),
    c: z.string().min(1),
    n: z.tuple([z.string(), z.string()]).optional(),
    showN: z.boolean().optional(),
    s: z.string().optional(),
    half: z.boolean().optional(),
  })
  .strict();

export const aislesSchema = z.array(z.tuple([z.string(), z.string()])).min(1);

export const packSchema = z
  .object({
    s: z.array(z.number().int().positive()).min(1).max(2),
    l: z.string().min(1),
    tol: z.number().positive().max(1).optional(),
  })
  .strict();

export const cookBlockSchema = z
  .object({
    mode: z.enum(COOK_MODES),
    active: z.number().nonnegative(),
    passive: z.number().nonnegative(),
    wait: z.literal(false).optional(),
    a: z.array(z.string()),
  })
  .strict();

export const seasonalVariantSchema = z
  .object({
    m: months,
    l: z.string().min(1),
    ing: ingredientQuantities,
    prep: z.array(z.string()),
  })
  .strict();

const batchBase = {
  id: z.string().min(1),
  n: z.string().min(1),
  s: z.string().min(1),
  d: z.string().min(1),
  o: country.nullable(),
  p: z.enum(PROTEINS),
  fridge: z.number().int().nonnegative(),
  freeze: z.boolean(),
  months: months.optional(),
  m: macros4,
  ing: ingredientQuantities,
  prepMin: z.number().nonnegative(),
  prep: z.array(z.string()),
  blocks: z.array(cookBlockSchema).min(1),
  box: z.string(),
  jj: z.string(),
  kid: z.string().optional(),
  cz: z.boolean().optional(),
  pasta: z.literal(true).optional(),
  comfort: z.literal(true).optional(),
  /** Macros inconnues (recette importée sans nutrition) : `m` vaut alors [0, 0, 0, 0]. */
  mu: z.literal(true).optional(),
};

export const mainSchema = z
  .object({
    ...batchBase,
    grp: z.string().min(1).optional(),
    oven: z.boolean(),
    sv: z.array(seasonalVariantSchema).min(1).optional(),
  })
  .strict();

export const soupSchema = z.object(batchBase).strict();

export const simpleSchema = z
  .object({
    id: z.string().min(1),
    n: z.string().min(1),
    s: z.string().min(1),
    o: country,
    m: macros4,
    ing: ingredientQuantities,
    steps: z.array(z.string()).min(1),
    months: months.optional(),
    pasta: z.literal(true).optional(),
    comfort: z.literal(true).optional(),
    mu: z.literal(true).optional(),
    /** Protéine déclarée (recettes importées) ; déduite des ingrédients pour le catalogue. */
    p: z.enum(PROTEINS).optional(),
  })
  .strict();

export const cakeSchema = z
  .object({
    id: z.string().min(1),
    n: z.string().min(1),
    t: z.enum(CAKE_TYPES),
    tm: z.string().min(1),
    parts: z.string().min(1),
    months: months.optional(),
    m: macros4,
    kid: z.string(),
    mu: z.literal(true).optional(),
    ing: ingredientQuantities,
    steps: z.array(z.string()).min(1),
  })
  .strict();

export const breakfastSchema = z
  .object({
    n: z.string().min(1),
    d: z.string().min(1),
    t: z.enum(["sucre", "sale"]),
    m: z.tuple([z.number(), z.number()]),
  })
  .strict();

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Pack = z.infer<typeof packSchema>;
export type Main = z.infer<typeof mainSchema>;
export type Soup = z.infer<typeof soupSchema>;
export type Simple = z.infer<typeof simpleSchema>;
export type Cake = z.infer<typeof cakeSchema>;
export type Breakfast = z.infer<typeof breakfastSchema>;

export const seedSchema = z.object({
  ingredients: z.record(z.string(), ingredientSchema),
  aisles: aislesSchema,
  packs: z.record(z.string(), packSchema),
  notSeasonal: z.array(z.string()),
  mains: z.array(mainSchema),
  soups: z.array(soupSchema),
  simples: z.array(simpleSchema),
  cakes: z.array(cakeSchema),
  breakfasts: z.array(breakfastSchema),
});

export type Seed = z.infer<typeof seedSchema>;
