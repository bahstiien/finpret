import { AISLE_LABELS, AISLE_ORDER, aisleOf, buyQty, labelOf, RECIPES, scaledTotals, type RecipeView } from "./catalog";
import {
  COMBINATIONS,
  GENERATED_MENUS_INDEXABLE,
  MEALS_PER_MENU,
  MIN_RECIPES_PER_MENU,
  menuSlug,
  type Combination,
  type Constraint,
} from "./config";

/**
 * Menus de la semaine types : composés de façon déterministe à partir du catalogue (aucun foyer, aucune donnée perso).
 * Même combinaison => même menu à chaque build.
 */

export type ShoppingGroup = { aisle: string; label: string; items: { label: string; qty: string }[] };
export type Faq = { q: string; a: string };

export type MenuView = {
  slug: string;
  combo: Combination;
  title: string;
  h1: string;
  intro: string[];
  recipes: RecipeView[];
  shopping: ShoppingGroup[];
  pantry: string[];
  faq: Faq[];
  indexable: boolean;
  /** Part de l'effectif de 4 personnes sur laquelle les quantités sont calculées. */
  scale: number;
};

/** Hachage stable (FNV-1a) : sert à ordonner le catalogue sans aléa. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}


/** Filtre du catalogue pour une contrainte (le seed marque les plats végétariens ; aucun autre critère n'est inféré). */
function matches(r: RecipeView, c: Constraint): boolean {
  return c === "vegetarien" ? r.vegetarian : true;
}

/** Plats et soupes du batch cooking. */
export function poolFor(): RecipeView[] {
  return RECIPES.filter((r) => r.batch);
}

/** Sélection déterministe : familles de plats et protéines variées, pas plus de 2 plats de pâtes. */
export function pick(pool: readonly RecipeView[], salt: string, n: number): RecipeView[] {
  const sorted = [...pool].sort((a, b) => hash(salt + a.id) - hash(salt + b.id));
  const out: RecipeView[] = [];
  const groups = new Set<string>();
  const proteins = new Map<string, number>();
  let pasta = 0;
  for (const r of sorted) {
    if (out.length === n) break;
    const g = r.id.split("_").slice(0, 2).join("_");
    if (groups.has(g)) continue;
    if (r.protein && (proteins.get(r.protein) ?? 0) >= 2) continue;
    if (r.pasta && pasta >= 2) continue;
    groups.add(g);
    if (r.protein) proteins.set(r.protein, (proteins.get(r.protein) ?? 0) + 1);
    if (r.pasta) pasta++;
    out.push(r);
  }
  // Si les règles de variété laissent trop peu de recettes, on complète sans elles plutôt que de perdre la page.
  for (const r of sorted) {
    if (out.length === n) break;
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

function shopping(recipes: readonly RecipeView[], scale: number): { groups: ShoppingGroup[]; pantry: string[] } {
  const total = scaledTotals(recipes, scale);
  const byAisle = new Map<string, { label: string; qty: string }[]>();
  const pantry: string[] = [];
  for (const [k, q] of Object.entries(total)) {
    const aisle = aisleOf(k);
    if (aisle === "base") {
      pantry.push(labelOf(k));
      continue;
    }
    byAisle.set(aisle, [...(byAisle.get(aisle) ?? []), { label: labelOf(k), qty: buyQty(k, q) }]);
  }
  const groups = AISLE_ORDER.filter((a) => byAisle.has(a)).map((aisle) => ({
    aisle,
    label: AISLE_LABELS.get(aisle) ?? aisle,
    items: byAisle.get(aisle)!.sort((a, b) => a.label.localeCompare(b.label, "fr")),
  }));
  return { groups, pantry: pantry.sort((a, b) => a.localeCompare(b, "fr")) };
}

const CONSTRAINT_NAME: Record<Constraint, string> = {
  classique: "",
  vegetarien: "végétarien",
};

function headings(combo: Combination) {
  const c = CONSTRAINT_NAME[combo.constraint];
  const h1 = `Menu de la semaine ${c ? `${c} ` : ""}pour ${combo.persons} personnes en batch cooking`;
  return { h1: h1.replace(/\s+/g, " "), title: h1.replace(/\s+/g, " ") };
}

/** Introduction propre à chaque combinaison ; seuls des faits du catalogue (recettes, congélation) y figurent. */
function intro(combo: Combination, recipes: RecipeView[]): string[] {
  const n = combo.persons;
  const angle: Record<Constraint, string> = {
    classique: `Cinq dîners de batch cooking pour ${n} personnes, avec une liste de courses calculée pour ${n} personnes.`,
    vegetarien: `Cinq dîners de batch cooking sans viande ni poisson pour ${n} personnes ; les œufs et les produits laitiers restent possibles.`,
  };
  const freezable = recipes.filter((r) => r.freezable).length;
  const facts = `Au menu : ${recipes.map((r) => r.short).join(", ")}. ${freezable} recette${freezable > 1 ? "s" : ""} sur ${recipes.length} se congèle${freezable > 1 ? "nt" : ""}.`;
  return [angle[combo.constraint], facts];
}

function faq(combo: Combination, recipes: RecipeView[]): Faq[] {
  const days = recipes.map((r) => r.fridgeDays ?? 0);
  return [
    {
      q: `Les quantités sont-elles calculées pour ${combo.persons} personnes ?`,
      a: `Oui. Les recettes sont écrites pour 4 portions adultes ; la liste de courses est mise à l'échelle pour ${combo.persons} portions adultes et arrondie aux contenants du commerce.`,
    },
    {
      q: "Combien de temps se conservent les plats au frigo ?",
      a: `Selon les recettes de ce menu, de ${Math.min(...days)} à ${Math.max(...days)} jours au frigo après la session. La durée est indiquée sur chaque recette.`,
    },
    {
      q: "Puis-je adapter ce menu à mon foyer ?",
      a: "Oui : l'application génère un menu à partir de ta composition de foyer, de tes goûts et de la saison, et recalcule la liste de courses.",
    },
  ];
}

export function buildMenu(combo: Combination): MenuView {
  const slug = menuSlug(combo);
  const pool = poolFor().filter((r) => matches(r, combo.constraint));
  const recipes = pick(pool, slug, MEALS_PER_MENU);
  const scale = combo.persons / 4;
  const { groups, pantry } = shopping(recipes, scale);
  const { h1, title } = headings(combo);
  return {
    slug,
    combo,
    title,
    h1,
    intro: intro(combo, recipes),
    recipes,
    shopping: groups,
    pantry,
    faq: faq(combo, recipes),
    indexable: GENERATED_MENUS_INDEXABLE && new Set(recipes.map((r) => r.id)).size >= MIN_RECIPES_PER_MENU,
    scale,
  };
}

export const MENUS: readonly MenuView[] = COMBINATIONS.map(buildMenu);
const menuBySlug = new Map(MENUS.map((m) => [m.slug, m]));
export const getMenu = (slug: string) => menuBySlug.get(slug) ?? null;
export const INDEXABLE_MENUS = MENUS.filter((m) => m.indexable);

/** Menus indexables qui contiennent la recette (maillage recette → menus). */
export const menusContaining = (recipeId: string) => INDEXABLE_MENUS.filter((m) => m.recipes.some((r) => r.id === recipeId));
