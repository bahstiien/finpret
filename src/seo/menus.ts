import { AISLE_LABELS, AISLE_ORDER, aisleOf, buyQty, labelOf, RECIPES, type RecipeView } from "./catalog";
import {
  COMBINATIONS,
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
export type PlanStep = { slug: string; name: string; activeMin: number; passiveMin: number; oven: boolean };
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
  plan: PlanStep[] | null;
  /** Durée estimée de la session de batch cooking, en minutes (arrondie à 5). */
  sessionMin: number | null;
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

const ingCount = (r: RecipeView) => Object.keys(r.raw).length;

/** Filtre du catalogue pour une contrainte. Les critères sont des proxys documentés dans SEO.md (le seed n'a pas de prix). */
function matches(r: RecipeView, c: Constraint, batch: boolean): boolean {
  switch (c) {
    case "classique":
      return true;
    case "budget":
      return batch
        ? ingCount(r) <= 8 && r.protein !== "poisson" && r.protein !== "boeuf"
        : ingCount(r) <= 6;
    case "vegetarien":
      return r.vegetarian;
    case "enfants":
      return r.difficulty <= 2 && (r.pasta || r.comfort || r.protein === "volaille" || r.protein === "porc" || r.vegetarian);
    case "rapide":
      return batch ? r.activeMin <= 25 : r.difficulty === 1;
  }
}

/** Pool de recettes d'un format : batch = plats et soupes du batch cooking ; quotidien = dîners express cuisinés le jour même. */
export function poolFor(batch: boolean): RecipeView[] {
  return RECIPES.filter((r) => (batch ? r.batch : r.kind === "simple"));
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

/** Ordre de la session : le four et les attentes longues d'abord, la durée totale suit le travail actif. */
export function planSession(recipes: readonly RecipeView[]): { steps: PlanStep[]; minutes: number } {
  const steps = recipes
    .map((r) => ({
      slug: r.slug,
      name: r.short,
      activeMin: r.activeMin,
      passiveMin: r.blocks.reduce((s, b) => s + b.passive, 0),
      oven: r.oven,
      tail: r.blocks.at(-1)?.passive ?? 0,
    }))
    .sort((a, b) => Number(b.oven) - Number(a.oven) || b.passiveMin - a.passiveMin);
  const active = steps.reduce((s, x) => s + x.activeMin, 0);
  const lastTail = Math.min(...steps.map((x) => x.tail));
  const ovenSeq = recipes
    .filter((r) => r.oven)
    .reduce((s, r) => s + r.blocks.filter((b) => b.mode === "four").reduce((t, b) => t + b.active + b.passive, 0), 0);
  const minutes = Math.ceil(Math.max(active + lastTail, ovenSeq) / 5) * 5;
  return { steps: steps.map(({ tail: _tail, ...s }) => s), minutes };
}

function shopping(recipes: readonly RecipeView[], scale: number): { groups: ShoppingGroup[]; pantry: string[] } {
  const total: Record<string, number> = {};
  for (const r of recipes) for (const [k, q] of Object.entries(r.raw)) total[k] = (total[k] ?? 0) + q * scale;
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
  budget: "pas cher",
  vegetarien: "végétarien",
  enfants: "pour enfants",
  rapide: "rapide",
};

function headings(combo: Combination) {
  const who = `${combo.persons} personnes`;
  const how = combo.format === "batch" ? " en batch cooking" : "";
  const c = CONSTRAINT_NAME[combo.constraint];
  const h1 = `Menu de la semaine ${c ? `${c} ` : ""}pour ${who}${how}`;
  return { h1: h1.replace(/\s+/g, " "), title: h1.replace(/\s+/g, " ") };
}

/** Texte d'introduction propre à chaque combinaison : un angle par contrainte, un angle par format, puis des chiffres du menu. */
function intro(combo: Combination, recipes: RecipeView[], sessionMin: number | null): string[] {
  const n = combo.persons;
  const batch = combo.format === "batch";
  const angle: Record<Constraint, string> = {
    classique: `Un menu équilibré pour ${n} personnes : une protéine différente presque chaque soir, des légumes de saison et pas deux plats de la même famille dans la semaine.`,
    budget: `Ce menu pour ${n} personnes mise sur des recettes à courte liste de courses (8 ingrédients au plus) et sur des protéines économiques : volaille, porc, légumineuses et œufs, sans poisson ni bœuf. Le prix exact dépend de ton magasin, nous ne le chiffrons pas.`,
    vegetarien: `Cinq dîners sans viande ni poisson pour ${n} personnes, avec des légumineuses, des œufs, des légumes et des féculents, pour rester rassasié sans repasser en cuisine chaque soir.`,
    enfants: `Un menu pensé pour une table avec des enfants, pour ${n} personnes : des recettes de difficulté 1 ou 2, des plats de pâtes et de réconfort, À table, on adapte l'assaisonnement dans l'assiette des grands.`,
    rapide: `Pour ${n} personnes, ce menu ne garde que des recettes à faible temps de travail actif (25 minutes ou moins par recette), idéal quand la semaine est déjà chargée.`,
  };
  const format = batch
    ? `Tout se prépare en une seule session de batch cooking, par exemple le dimanche : environ ${sessionMin ?? "—"} minutes au total, avec l'ordre des préparations ci-dessous. Les plats se conservent au frigo puis se réchauffent en quelques minutes.`
    : `Ici, pas de session de préparation : chaque dîner est cuisiné le jour même, en 20 minutes environ de travail actif, à partir d'une liste de courses unique pour la semaine.`;
  const freezable = recipes.filter((r) => r.freezable).length;
  const facts = batch
    ? `Au menu : ${recipes.map((r) => r.short).join(", ")}. ${freezable} recette${freezable > 1 ? "s" : ""} sur ${recipes.length} se congèle${freezable > 1 ? "nt" : ""} si tu veux prendre de l'avance.`
    : `Au menu : ${recipes.map((r) => r.short).join(", ")}.`;
  return [angle[combo.constraint], format, facts];
}

function faq(combo: Combination, recipes: RecipeView[]): Faq[] {
  const batch = combo.format === "batch";
  const out: Faq[] = [
    {
      q: `Les quantités sont-elles calculées pour ${combo.persons} personnes ?`,
      a: `Oui. Les recettes sont écrites pour 4 portions adultes ; la liste de courses est mise à l'échelle pour ${combo.persons} personnes et arrondie aux contenants du commerce. Pour des enfants, qui mangent moins, tu peux acheter un peu moins.`,
    },
  ];
  if (batch) {
    const days = recipes.map((r) => r.fridgeDays ?? 0);
    const min = Math.min(...days);
    out.push({
      q: "Combien de temps se conservent les plats au frigo ?",
      a: `Selon les recettes de ce menu, de ${min} à ${Math.max(...days)} jours au frigo après la session. Les durées sont indiquées sur chaque recette ; les plats qui se congèlent sont signalés.`,
    });
    out.push({
      q: "Peut-on congeler ces plats ?",
      a: `${recipes.filter((r) => r.freezable).length} recette(s) sur ${recipes.length} se congèlent. Décongèle-les la veille au frigo.`,
    });
  } else {
    out.push({
      q: "Faut-il préparer quelque chose à l'avance ?",
      a: "Non, ce menu ne demande pas de session de batch cooking. Seule la liste de courses se fait une fois pour la semaine.",
    });
  }
  out.push({
    q: "Puis-je adapter ce menu à mon foyer ?",
    a: "Oui : l'application génère un menu à partir de ta composition de foyer, de tes goûts et de la saison, et recalcule la liste de courses.",
  });
  return out;
}

export function buildMenu(combo: Combination): MenuView {
  const batch = combo.format === "batch";
  const slug = menuSlug(combo);
  const pool = poolFor(batch).filter((r) => matches(r, combo.constraint, batch));
  const recipes = pick(pool, slug, MEALS_PER_MENU);
  const scale = combo.persons / 4;
  const { groups, pantry } = shopping(recipes, scale);
  const session = batch && recipes.length ? planSession(recipes) : null;
  const { h1, title } = headings(combo);
  return {
    slug,
    combo,
    title,
    h1,
    intro: intro(combo, recipes, session?.minutes ?? null),
    recipes,
    shopping: groups,
    pantry,
    plan: session?.steps ?? null,
    sessionMin: session?.minutes ?? null,
    faq: faq(combo, recipes),
    indexable: new Set(recipes.map((r) => r.id)).size >= MIN_RECIPES_PER_MENU,
    scale,
  };
}

export const MENUS: readonly MenuView[] = COMBINATIONS.map(buildMenu);
const menuBySlug = new Map(MENUS.map((m) => [m.slug, m]));
export const getMenu = (slug: string) => menuBySlug.get(slug) ?? null;
export const INDEXABLE_MENUS = MENUS.filter((m) => m.indexable);

/** Menus indexables qui contiennent la recette (maillage recette → menus). */
export const menusContaining = (recipeId: string) => INDEXABLE_MENUS.filter((m) => m.recipes.some((r) => r.id === recipeId));
