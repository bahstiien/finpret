import { guessAisle } from "../shopping";
import type { Ingredient, Protein, Unit } from "../catalog/schema";
import type { Library } from "../types";
import { parseIngredientLine, type ParsedLine } from "./ingredient-line";
import type { ExtractedRecipe } from "./jsonld";
import { type Candidate, matchIngredient } from "./match";
import { isoMinutes, parseYield } from "./units";

/** Brouillon d'import (§8.8, étapes 4 à 6) : ce que l'écran de validation affiche et que l'utilisateur corrige. */

export type ImportKind = "main" | "soup" | "simple" | "cake";

export type DraftLine = {
  original: string;
  /** Ingrédient du catalogue (ou du foyer) rapproché ; null = nouvel ingrédient du foyer. */
  key: string | null;
  label: string;
  /** Quantité pour 4 portions, dans l'unité de l'ingrédient (`unit`). null = au goût. */
  qty: number | null;
  unit: Unit;
  aisle: string;
  toTaste: boolean;
  /** Rapprochement incertain ou conversion impossible : ligne surlignée. */
  uncertain: boolean;
  candidates: Candidate[];
};

export type ImportDraft = {
  name: string;
  sourceUrl: string;
  sourceName: string;
  /** Portions de la recette d'origine (null : à demander). */
  servings: number | null;
  totalMin: number | null;
  prepMin: number | null;
  cookMin: number | null;
  kind: ImportKind;
  protein: Protein;
  origin: string;
  pasta: boolean;
  comfort: boolean;
  oven: boolean;
  fridge: number;
  freeze: boolean;
  months: number[] | null;
  /** [kcal, protéines, glucides, lipides] par portion, lus sur le site ; null si inconnus. */
  macros: [number, number, number, number] | null;
  lines: DraftLine[];
  steps: string[];
};

/** Clés du catalogue qui déterminent la protéine (rayon « viande », §8.8). */
const PROTEIN_OF: Record<string, Exclude<Protein, "veg">> = {
  poulet: "volaille",
  dinde: "volaille",
  cuisse: "volaille",
  boeuf: "boeuf",
  steak: "boeuf",
  paleron: "boeuf",
  agneau: "boeuf",
  jambon: "porc",
  lardons: "porc",
  saucisse: "porc",
  echine: "porc",
  saumon: "poisson",
  cabillaud: "poisson",
  thon: "poisson",
  saumonfume: "poisson",
};
const PROTEIN_WORDS: [RegExp, Exclude<Protein, "veg">][] = [
  [/poulet|dinde|canard|volaille|pintade/i, "volaille"],
  [/b(œ|oe)uf|veau|agneau|mouton|steak/i, "boeuf"],
  [/porc|jambon|lardon|saucisse|chorizo|bacon|pancetta|lard\b/i, "porc"],
  [
    /poisson|saumon|cabillaud|thon|crevette|moule|colin|merlu|sardine|maquereau|truite|lieu|calamar|crabe|gambas|saint-jacques/i,
    "poisson",
  ],
];

/** Cuisine (`recipeCuisine`) vers les codes d'origine du catalogue. */
const CUISINES: [RegExp, string][] = [
  [/fran(ç|c)ais|france/i, "fr"],
  [/ital/i, "it"],
  [/espagn/i, "es"],
  [/gr(e|è)c/i, "gr"],
  [/maroc/i, "ma"],
  [/liban/i, "lb"],
  [/tunisi/i, "tn"],
  [/indien|inde\b/i, "in"],
  [/tha(ï|i)/i, "th"],
  [/japon/i, "jp"],
  [/cor(é|e)en/i, "kr"],
  [/chin/i, "cn"],
  [/vietnam/i, "vn"],
  [/mexic/i, "mx"],
  [/am(é|e)ric/i, "us"],
  [/anglais|britann/i, "gb"],
  [/belg/i, "be"],
  [/hongr/i, "hu"],
  [/suisse/i, "ch"],
];

/** Mot entier, accents compris (`\b` ignore les lettres accentuées). */
const word = (alt: string) => new RegExp(`(?<!\\p{L})(?:${alt})(?!\\p{L})`, "iu");
const SOUP = word("soupes?|velout(é|e)s?|potages?|gaspacho|minestrone|bouillon|bisque|chorba|harira");
const CAKE = word(
  "g(â|a)teaux?|cakes?|brioches?|biscuits?|cookies?|sabl(é|e)s?|cr(ê|e)pes?|muffins?|madeleines?|financiers?|brownies?|quatre-quarts|gaufres?|pancakes?|clafoutis|crumble|banana bread",
);
const PASTA = word(
  "p(â|a)tes|spaghetti|tagliatelles?|penne|fusilli|macaroni|lasagnes?|linguine|coquillettes?|farfalle|raviolis?|gnocchis?|orzo|nouilles",
);
const COMFORT = word(
  "gratins?|tartiflette|raclette|lasagnes?|hachis|parmentier|croziflette|fondue|mac and cheese|croque|quiches?|pizzas?",
);
const OVEN = /\bfour\b|°\s?C|\bth\.?\s?\d|thermostat|gratine/i;
/** Plats qui se congèlent mal (§8.8) : crème, œufs, pommes de terre entières. */
const NO_FREEZE_KEYS = ["creme", "oeufs", "pommedeterre"];

const round = (n: number, step = 1) => Math.round(n / step) * step;

/** Quantité de la ligne convertie dans l'unité de l'ingrédient ; null si incompatible. */
export function convert(qty: number, from: ParsedLine["unit"], to: Unit): number | null {
  if (from === null) return to === "pc" || to === "boite" ? qty : null;
  if (from === to) return qty;
  const ml: Partial<Record<Unit, number>> = { ml: 1, cs: 15, cc: 5 };
  if (ml[from] && ml[to]) return (qty * ml[from]) / ml[to];
  // Liquides et masses : approximation 1 ml ≈ 1 g (crème, lait, eau).
  if ((from === "ml" && to === "g") || (from === "g" && to === "ml")) return qty;
  if (from === "cs" && to === "g") return qty * 15;
  if (from === "cc" && to === "g") return qty * 5;
  return null;
}

/** Quantité arrondie comme dans le catalogue (grammes à 5 près, pièces à ½ près). */
const tidy = (qty: number, unit: Unit) =>
  unit === "g" || unit === "ml"
    ? Math.max(1, qty >= 50 ? round(qty, 5) : round(qty))
    : Math.max(0.5, round(qty, 0.5));

/**
 * Mois de saison des légumes, déduits des recettes du catalogue qui en contiennent et ont des mois définis.
 * TODO(spec) : pas de table légumes → mois dans le seed ; cette déduction est une approximation.
 */
export function vegMonths(lib: Library): Record<string, number[]> {
  const out: Record<string, Set<number>> = {};
  for (const r of [...lib.mains, ...lib.soups, ...lib.simples]) {
    if (!r.months) continue;
    for (const k of Object.keys(r.ing)) {
      if (lib.ingredients[k]?.c !== "legumes" || lib.notSeasonal.includes(k)) continue;
      out[k] ??= new Set();
      for (const m of r.months) out[k].add(m);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, s]) => [k, [...s].sort((a, b) => a - b)]));
}

const firstNumber = (s: string | undefined) => {
  const m = s?.match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1]!.replace(",", ".")) : null;
};

export type DraftInput = {
  recipe: ExtractedRecipe;
  url: string;
  sourceName: string;
  lib: Library;
  synonyms?: Record<string, string>;
  /** Portions saisies par l'utilisateur quand `recipeYield` manque. */
  servings?: number | null;
};

export function buildDraft({
  recipe,
  url,
  sourceName,
  lib,
  synonyms,
  servings: forced,
}: DraftInput): ImportDraft {
  const servings = forced ?? parseYield(recipe.yield);
  const isCake = guessKind(recipe, null) === "cake";
  // Les goûters gardent les quantités d'origine (un gâteau entier, découpé en parts) ; le reste passe à 4 portions.
  const factor = servings && !isCake ? 4 / servings : 1;

  const lines: DraftLine[] = recipe.ingredients.map((raw) => {
    const p = parseIngredientLine(raw);
    const match = matchIngredient(p, lib.ingredients, synonyms);
    const ing: Ingredient | undefined = match.key ? lib.ingredients[match.key] : undefined;
    const unit: Unit = ing?.u ?? p.unit ?? p.alt?.unit ?? "pc";
    const toTaste = p.toTaste || (!!ing && ing.c === "base" && p.qty === null);
    let qty: number | null = null;
    let uncertain = !toTaste && (!match.key || (match.method === "similarity" && match.score < 0.9));
    if (p.qty !== null && !toTaste) {
      const converted = convert(p.qty, p.unit, unit) ?? (p.alt ? convert(p.alt.qty, p.alt.unit, unit) : null);
      if (converted === null) uncertain = true;
      else qty = tidy(converted * factor, unit);
    } else if (!toTaste) {
      uncertain = true;
    }
    return {
      original: p.original,
      key: match.key,
      label: ing?.l ?? p.label,
      qty,
      unit,
      aisle: ing?.c ?? (toTaste ? "base" : guessAisle(p.label)),
      toTaste,
      uncertain,
      candidates: match.candidates,
    };
  });

  const all = `${recipe.name} ${recipe.category ?? ""} ${recipe.keywords ?? ""}`;
  const steps = recipe.instructions.join(" ");
  const totalMin =
    isoMinutes(recipe.totalTime) ?? sum(isoMinutes(recipe.prepTime), isoMinutes(recipe.cookTime));

  const kind = guessKind(recipe, totalMin);

  const proteins = lines
    .map((l) =>
      l.key
        ? PROTEIN_OF[l.key]
        : l.aisle === "viande"
          ? PROTEIN_WORDS.find(([re]) => re.test(l.label))?.[1]
          : undefined,
    )
    .filter((p): p is Exclude<Protein, "veg"> => !!p);
  // Première protéine animale de la liste (en général l'ingrédient principal).
  const protein: Protein = proteins[0] ?? "veg";

  const origin = CUISINES.find(([re]) => re.test(recipe.cuisine ?? ""))?.[1] ?? "fr";
  const keys = new Set(lines.map((l) => l.key).filter(Boolean) as string[]);

  const seasons = vegMonths(lib);
  const veg = [...keys].filter((k) => seasons[k]?.length);
  let months: number[] | null = null;
  if (veg.length) {
    const inter = veg.map((k) => seasons[k]!).reduce((a, b) => a.filter((m) => b.includes(m)));
    months = inter.length && inter.length < 12 ? inter : null;
  }

  const kcal = firstNumber(recipe.nutrition?.calories);
  const prot = firstNumber(recipe.nutrition?.protein);
  // La nutrition des sites est donnée par portion (`servingSize`) ; sans protéines, les macros restent inconnues.
  const macros: ImportDraft["macros"] =
    kcal !== null && prot !== null ? [round(kcal), round(prot), 0, 0] : null;

  return {
    name: recipe.name,
    sourceUrl: url,
    sourceName,
    servings,
    totalMin,
    prepMin: isoMinutes(recipe.prepTime),
    cookMin: isoMinutes(recipe.cookTime),
    kind,
    protein,
    origin,
    pasta: PASTA.test(all) || [...keys].some((k) => /^pates|^nouilles|gnocchis/.test(k)),
    comfort: COMFORT.test(all),
    oven: OVEN.test(steps),
    fridge: protein === "poisson" ? 2 : 3,
    freeze: kind !== "cake" && kind !== "simple" && !NO_FREEZE_KEYS.some((k) => keys.has(k)),
    months,
    macros,
    lines,
    // Les étapes d'origine ne sont jamais reprises telles quelles (§8.8) : reformulées par le modèle, ou écrites par l'utilisateur.
    steps: [],
  };
}

/** Type proposé : soupe ou goûter d'après le nom, sinon soir simple (30 min ou moins) ou plat de batch (§8.8). */
function guessKind(recipe: ExtractedRecipe, totalMin: number | null): ImportKind {
  if (SOUP.test(recipe.name)) return "soup";
  if (CAKE.test(recipe.name) || /dessert|go(û|u)ter|p(â|a)tisserie/i.test(recipe.category ?? ""))
    return "cake";
  return totalMin !== null && totalMin <= 30 ? "simple" : "main";
}

const sum = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

/** « 12 ingrédients reconnus sur 13 » (les lignes au goût comptent comme reconnues). */
export const quality = (lines: Pick<DraftLine, "key" | "toTaste" | "uncertain">[]) => ({
  matched: lines.filter((l) => !l.uncertain && (l.key || l.toTaste)).length,
  total: lines.length,
});
