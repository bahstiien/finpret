import { fill, fmtQ, shopQ } from "@/engine/format";
import type { Library } from "@/engine/types";
import { rawSeed } from "@/engine/catalog/seed-files";
import { seedSchema, type Cake, type Main, type Simple, type Soup } from "@/engine/catalog/schema";
import { originOf } from "@/engine/origins";
import { RECIPE_PHOTOS, type RecipePhoto } from "./images";

/**
 * Catalogue public : recettes types du seed (`seed/*.json`), lues au build, sans base de données.
 * Ce sont des données du catalogue global, jamais des données d'utilisateur.
 */

export type RecipeKind = "plat" | "soupe" | "simple" | "gouter";

export type Line = { key: string; label: string; qty: string; aisle: string };
export type Variant = { label: string; months: number[]; ingredients: Line[] };
export type Block = { mode: string; active: number; passive: number; wait: boolean };

export type RecipeView = {
  slug: string;
  id: string;
  kind: RecipeKind;
  name: string;
  short: string;
  description: string | null;
  country: string | null;
  protein: string | null;
  vegetarian: boolean;
  /** Ingrédients pour 4 personnes (version de référence, avec la première variante de saison s'il y en a). */
  ingredients: Line[];
  /** Quantités brutes pour 4 personnes, pour consolider les courses d'un menu. */
  raw: Record<string, number>;
  steps: string[];
  prepMin: number | null;
  cookMin: number | null;
  totalMin: number | null;
  /** Temps de travail actif (hors attente), en minutes. */
  activeMin: number;
  yieldText: string;
  fridgeDays: number | null;
  freezable: boolean;
  storage: string | null;
  reheat: string | null;
  kidTip: string | null;
  difficulty: number;
  nutrition: { kcal: number; protein: number; carbs: number; fat: number } | null;
  months: number[] | null;
  variants: Variant[];
  batch: boolean;
  oven: boolean;
  pasta: boolean;
  comfort: boolean;
  blocks: Block[];
  photo: RecipePhoto | null;
};

const seed = seedSchema.parse(rawSeed);

const lib: Library = {
  mains: seed.mains,
  soups: seed.soups,
  simples: seed.simples,
  cakes: seed.cakes,
  ingredients: seed.ingredients,
  packs: seed.packs,
  notSeasonal: seed.notSeasonal,
  aisles: seed.aisles,
};

export const slugOf = (id: string) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const MEAT_AISLE = "viande";

function lines(raw: Record<string, number>): Line[] {
  return Object.entries(raw)
    .filter(([k]) => lib.ingredients[k])
    .map(([k, q]) => ({
      key: k,
      label: lib.ingredients[k]!.l,
      qty: fmtQ(lib, k, q),
      aisle: lib.ingredients[k]!.c,
    }));
}

/** Durée de cuisson : un bloc `wait:false` chevauche le précédent. */
function cookMinutes(blocks: Block[]): number {
  let total = 0;
  let prev = 0;
  for (const b of blocks) {
    const d = b.active + b.passive;
    total += b.wait ? d : Math.max(0, d - prev);
    prev = d;
  }
  return total;
}

function nutrition(m: readonly number[], unknown?: boolean) {
  if (unknown || !m[0]) return null;
  return { kcal: m[0]!, protein: m[1]!, carbs: m[2]!, fat: m[3]! };
}

function fromBatch(r: Main | Soup, kind: "plat" | "soupe"): RecipeView {
  const sv = "sv" in r ? r.sv : undefined;
  const first = sv?.[0];
  const ing = { ...r.ing, ...(first?.ing ?? {}) };
  const prep = [...r.prep, ...(first?.prep ?? [])];
  const blocks = r.blocks.map((b) => ({ mode: b.mode, active: b.active, passive: b.passive, wait: b.wait !== false }));
  const cook = cookMinutes(blocks);
  const slug = slugOf(r.id);
  const aisles = Object.keys(ing).map((k) => lib.ingredients[k]?.c);
  return {
    slug,
    id: r.id,
    kind,
    name: r.n,
    short: r.s,
    description: r.d,
    country: originOf(r.o)?.name ?? null,
    protein: r.p,
    vegetarian: r.p === "veg" && !aisles.includes(MEAT_AISLE),
    ingredients: lines(ing),
    raw: ing,
    steps: [...prep, ...r.blocks.flatMap((b) => b.a)].map((s) => fill(lib, s, ing, 1)),
    prepMin: r.prepMin,
    cookMin: cook,
    totalMin: r.prepMin + cook,
    activeMin: r.prepMin + r.blocks.reduce((s, b) => s + b.active, 0),
    yieldText: "4 portions",
    fridgeDays: r.fridge,
    freezable: r.freeze,
    storage: r.box || null,
    reheat: r.jj || null,
    kidTip: r.kid ?? null,
    difficulty: r.diff,
    nutrition: nutrition(r.m, r.mu),
    months: r.months ?? null,
    variants: (sv ?? []).slice(1).map((v) => ({ label: v.l, months: v.m, ingredients: lines(v.ing) })),
    batch: true,
    oven: ("oven" in r && r.oven === true) || blocks.some((b) => b.mode === "four"),
    pasta: r.pasta === true,
    comfort: r.comfort === true,
    blocks,
    photo: RECIPE_PHOTOS[slug] ?? null,
  };
}

function fromSimple(r: Simple): RecipeView {
  const slug = slugOf(r.id);
  const aisles = Object.keys(r.ing).map((k) => lib.ingredients[k]?.c);
  return {
    slug,
    id: r.id,
    kind: "simple",
    name: r.n,
    short: r.s,
    description: null,
    country: originOf(r.o)?.name ?? null,
    protein: r.p ?? null,
    vegetarian: !aisles.includes(MEAT_AISLE),
    ingredients: lines(r.ing),
    raw: r.ing,
    steps: r.steps.map((s) => fill(lib, s, r.ing, 1)),
    prepMin: null,
    cookMin: null,
    totalMin: null,
    activeMin: 20,
    yieldText: "4 portions",
    fridgeDays: null,
    freezable: false,
    storage: null,
    reheat: null,
    kidTip: null,
    difficulty: r.diff,
    nutrition: nutrition(r.m, r.mu),
    months: r.months ?? null,
    variants: [],
    batch: false,
    oven: false,
    pasta: r.pasta === true,
    comfort: r.comfort === true,
    blocks: [],
    photo: RECIPE_PHOTOS[slug] ?? null,
  };
}

function fromCake(r: Cake): RecipeView {
  const slug = slugOf(r.id);
  const m = /^(?:(\d+)\s*h\s*)?(\d+)?\s*(?:min)?$/.exec(r.tm.trim());
  const total = m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) : 0;
  return {
    slug,
    id: r.id,
    kind: "gouter",
    name: r.n,
    short: r.n,
    description: null,
    country: null,
    protein: null,
    vegetarian: true,
    ingredients: lines(r.ing),
    raw: r.ing,
    steps: r.steps.map((s) => fill(lib, s, r.ing, 1)),
    prepMin: null,
    cookMin: null,
    totalMin: total || null,
    activeMin: 20,
    yieldText: r.parts,
    fridgeDays: null,
    freezable: false,
    storage: null,
    reheat: null,
    kidTip: r.kid,
    difficulty: r.diff,
    nutrition: nutrition(r.m, r.mu),
    months: r.months ?? null,
    variants: [],
    batch: false,
    oven: true,
    pasta: false,
    comfort: false,
    blocks: [],
    photo: RECIPE_PHOTOS[slug] ?? null,
  };
}

const ALL: RecipeView[] = [
  ...seed.mains.map((r) => fromBatch(r, "plat")),
  ...seed.soups.map((r) => fromBatch(r, "soupe")),
  ...seed.simples.map(fromSimple),
  ...seed.cakes.map(fromCake),
];

/** Le seed contient des doublons de nom exact : on ne publie que la première occurrence (pas de duplicate content). */
const seenNames = new Set<string>();
export const RECIPES: readonly RecipeView[] = ALL.filter((r) => {
  const key = r.name.trim().toLowerCase();
  if (seenNames.has(key)) return false;
  seenNames.add(key);
  return true;
});

const shortCount = new Map<string, number>();
for (const r of RECIPES) shortCount.set(r.short, (shortCount.get(r.short) ?? 0) + 1);
/** Nom d'affichage pour les titres : le nom court, ou le nom complet quand deux recettes partagent le même nom court. */
export const displayName = (r: RecipeView) => ((shortCount.get(r.short) ?? 0) > 1 ? r.name : r.short);

const bySlug = new Map(RECIPES.map((r) => [r.slug, r]));
export const getRecipe = (slug: string) => bySlug.get(slug) ?? null;

/** Quantité d'achat dans les contenants du commerce, pour la liste de courses. */
export const buyQty = (key: string, qty: number) => shopQ(lib, key, qty);
export const labelOf = (key: string) => lib.ingredients[key]?.l ?? key;
export const aisleOf = (key: string) => lib.ingredients[key]?.c ?? "divers";
export const AISLE_LABELS = new Map<string, string>([...seed.aisles, ["base", "Placard (à vérifier chez toi)"]]);
export const AISLE_ORDER = [...seed.aisles.map(([k]) => k), "base"];

export const KIND_LABEL: Record<RecipeKind, string> = {
  plat: "Plat de batch cooking",
  soupe: "Soupe de batch cooking",
  simple: "Dîner express",
  gouter: "Goûter",
};
export const KIND_CATEGORY: Record<RecipeKind, string> = {
  plat: "Plat principal",
  soupe: "Soupe",
  simple: "Plat principal",
  gouter: "Goûter",
};
