import { num } from "@/engine/format";
import { portionForAge } from "@/engine/portions";
import {
  AISLE_LABELS,
  AISLE_ORDER,
  aisleOf,
  buyQty,
  displayName,
  labelOf,
  RECIPES,
  scaledTotals,
  type Line,
  type RecipeView,
} from "./catalog";
import { pick, type Faq } from "./menus";

/**
 * Exemples de semaine : une courte série de pages éditoriales (menu + courses, foyer avec enfants, végétarien).
 * Chaque page est calculée à partir du seed et des règles du moteur (portions par âge, quantités arrondies aux
 * contenants, conservation au frigo). Aucune donnée d'utilisateur. Les recettes d'une page ne se retrouvent dans
 * aucune autre page de la série.
 */

export const EXAMPLES_BASE = "/menu-de-la-semaine";
/** Date de dernière mise à jour du contenu de ces pages (lastmod du sitemap). */
export const EXAMPLES_LASTMOD = "2026-11-03";
export const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"] as const;

export type Household = { adults: number; childAges: readonly number[] };

type Def = {
  slug: string;
  /** Titre de la page (h1) et libellé court des liens. */
  h1: string;
  label: string;
  household: Household;
  /** Filtre diététique sur les plats de batch cooking. */
  vegetarian: boolean;
  /** Angle éditorial de l'introduction, rédigé à la main ; les chiffres sont ajoutés par `intro()`. */
  angle: string;
  /** Question traitée par cette page, pour les liens entre pages. */
  teaser: string;
};

const DEFS: readonly Def[] = [
  {
    slug: "avec-liste-de-courses",
    h1: "Menu de la semaine avec liste de courses",
    label: "Menu de la semaine et liste de courses",
    household: { adults: 2, childAges: [] },
    vegetarian: false,
    angle:
      "Un exemple complet pour deux adultes : cinq dîners, les quantités à acheter rayon par rayon et l'ordre dans lequel les manger.",
    teaser: "Cinq dîners pour deux adultes, avec les courses rayon par rayon.",
  },
  {
    slug: "2-adultes-2-enfants",
    h1: "Menu de la semaine pour 2 adultes et 2 enfants",
    label: "Menu pour 2 adultes et 2 enfants",
    household: { adults: 2, childAges: [4, 9] },
    vegetarian: false,
    angle:
      "Un exemple pour deux adultes et deux enfants de 4 et 9 ans : les portions d'enfant suivent l'âge, et les quantités sont calculées en conséquence.",
    teaser: "Comment les portions des enfants changent les quantités à acheter.",
  },
  {
    slug: "vegetarien",
    h1: "Menu de la semaine végétarien avec liste de courses",
    label: "Menu de la semaine végétarien",
    household: { adults: 2, childAges: [6] },
    vegetarian: true,
    angle:
      "Cinq dîners sans viande ni poisson pour deux adultes et un enfant de 6 ans, avec la liste de courses et l'organisation de la semaine.",
    teaser: "Cinq dîners sans viande ni poisson, œufs et laitages autorisés.",
  },
];

export type Day = (typeof DAYS)[number];
export type Slot = {
  day: Day;
  recipe: RecipeView;
  /** Où se trouve le plat ce soir-là : au frigo (durée de la recette) ou sorti du congélateur. */
  from: "frigo" | "congelateur";
};

export type ShoppingGroup = { aisle: string; label: string; items: { label: string; qty: string }[] };

export type ExampleView = {
  slug: string;
  path: string;
  h1: string;
  label: string;
  teaser: string;
  household: Household;
  /** Une ligne par membre du foyer : libellé et portion (règle du moteur). */
  members: { label: string; portion: number }[];
  portions: number;
  scale: number;
  intro: string[];
  slots: Slot[];
  shopping: ShoppingGroup[];
  pantry: string[];
  /** Somme du travail actif indiqué par les recettes (minutes) : n'est pas la durée d'une session. */
  activeTotal: number;
  equipment: string[];
  vegetarianProteins: { name: string; protein: number }[] | null;
  faq: Faq[];
  /** Goûter à faire avec les enfants (seed : tâche d'enfant renseignée) pour les foyers avec enfants. */
  snack: RecipeView | null;
};

const MODE_LABEL: Record<string, string> = {
  feu: "plaques de cuisson",
  four: "four",
  airfryer: "airfryer",
  micro: "micro-ondes",
  blender: "blender chauffant",
  mixeur: "mixeur plongeant",
  robot: "robot de cuisine",
  plan: "plan de travail",
};
const MODE_ORDER = ["feu", "four", "airfryer", "micro", "blender", "mixeur", "robot"];

export const portionLabel = (n: number) => num(Math.round(n * 100) / 100);

/** Affecte les plats aux soirs : ceux qui se gardent le moins longtemps d'abord ; le reste doit se congeler. */
export function schedule(recipes: readonly RecipeView[]): Slot[] | null {
  const sorted = [...recipes].sort((a, b) => (a.fridgeDays ?? 0) - (b.fridgeDays ?? 0) || a.id.localeCompare(b.id));
  const slots: Slot[] = [];
  for (const [i, recipe] of sorted.entries()) {
    const day = DAYS[i]!;
    if ((recipe.fridgeDays ?? 0) >= i + 1) slots.push({ day, recipe, from: "frigo" });
    else if (recipe.freezable) slots.push({ day, recipe, from: "congelateur" });
    else return null;
  }
  return slots;
}

/** Jours depuis la session du dimanche (dimanche = 0) : le lundi vaut 1. */
export const dayOffset = (day: Day) => DAYS.indexOf(day) + 1;

function members(h: Household) {
  return [
    ...Array.from({ length: h.adults }, (_, i) => ({ label: `Adulte ${i + 1}`, portion: 1 })),
    ...h.childAges.map((age, i) => ({
      label: `Enfant ${i + 1}, ${age} an${age > 1 ? "s" : ""}`,
      portion: portionForAge(age),
    })),
  ];
}

function groupShopping(recipes: readonly RecipeView[], scale: number) {
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
  const shopping: ShoppingGroup[] = AISLE_ORDER.filter((a) => byAisle.has(a)).map((aisle) => ({
    aisle,
    label: AISLE_LABELS.get(aisle) ?? aisle,
    items: byAisle.get(aisle)!.sort((a, b) => a.label.localeCompare(b.label, "fr")),
  }));
  return { shopping, pantry: pantry.sort((a, b) => a.localeCompare(b, "fr")) };
}

/** Plats retenus : batch cooking, valables toute l'année (ni variante de saison ni mois restreints). */
const basePool = (vegetarian: boolean) =>
  RECIPES.filter(
    (r) =>
      r.kind === "plat" &&
      !r.seasonal &&
      r.months === null &&
      (vegetarian ? r.vegetarian : true) &&
      r.fridgeDays !== null,
  );

function compose(def: Def, used: ReadonlySet<string>): { recipes: RecipeView[]; slots: Slot[] } {
  const pool = basePool(def.vegetarian).filter((r) => !used.has(r.id));
  for (let attempt = 0; attempt < 200; attempt++) {
    const recipes = pick(pool, `${def.slug}#${attempt}`, DAYS.length);
    if (recipes.length < DAYS.length) break;
    const slots = schedule(recipes);
    if (slots && slots.filter((s) => s.from === "congelateur").length <= 1) return { recipes, slots };
  }
  throw new Error(`Impossible de composer l'exemple ${def.slug}`);
}

function snackFor(def: Def): RecipeView | null {
  if (!def.household.childAges.length) return null;
  const pool = RECIPES.filter((r) => r.kind === "gouter" && !r.months && r.kidTip && r.difficulty <= 2 && r.timeText);
  return [...pool].sort((a, b) => a.id.localeCompare(b.id))[def.household.childAges.length % pool.length] ?? null;
}

function intro(def: Def, portions: number, slots: readonly Slot[], activeTotal: number): string[] {
  const names = slots.map((s) => `${s.day} : ${displayName(s.recipe)}`).join(" ; ");
  const kids = def.household.childAges.length;
  const frozen = slots.filter((s) => s.from === "congelateur");
  return [
    def.angle,
    `Ce foyer compte ${portionLabel(portions)} portions adultes par repas. Au menu, ${names}.`,
    `Le travail actif cumulé des cinq recettes est de ${activeTotal} minutes, hors attente. ${
      frozen.length
        ? `${frozen.map((s) => `${displayName(s.recipe)} (${s.recipe.fridgeDays} jours au frigo) est prévu depuis le congélateur le ${s.day}, jour ${dayOffset(s.day)}`).join(" ; ")}, car sa durée au frigo est dépassée ce soir-là et la recette se congèle.`
        : "Tous les plats tiennent au frigo jusqu'au soir prévu."
    }${kids ? " Un goûter à préparer avec les enfants complète la page." : ""}`,
  ];
}

function faq(def: Def, portions: number, scale: number): Faq[] {
  const out: Faq[] = [
    {
      q: "D'où viennent les quantités de la liste de courses ?",
      a: `Les recettes sont écrites pour 4 portions adultes. Ici, ${portionLabel(portions)} portions : chaque quantité est multipliée par ${num(Math.round(scale * 10000) / 10000)}, puis arrondie au contenant vendu en magasin, comme dans l'application.`,
    },
  ];
  if (def.household.childAges.length) {
    out.push({
      q: "Comment sont comptées les portions des enfants ?",
      a: "Un adulte compte 1 portion. Un enfant compte 0,33 portion avant 3 ans, 0,5 de 3 à 6 ans, 0,75 de 7 à 11 ans et 1 à partir de 12 ans. Dans l'application, tu peux modifier la portion de chaque enfant.",
    });
  }
  out.push({
    q: "Pourquoi ces plats ne dépendent-ils pas de la saison ?",
    a: "Cet exemple n'utilise que des recettes sans variante de saison, pour que les quantités soient les mêmes toute l'année. L'application, elle, compose le menu avec les légumes du mois.",
  });
  out.push({
    q: "Que change Fin Prêt à cet exemple ?",
    a: "L'application part de la composition réelle de ton foyer, de tes goûts, de tes allergies et du mois en cours, puis recalcule le menu, la liste de courses et la session de cuisine.",
  });
  return out;
}

export function buildExamples(): ExampleView[] {
  const used = new Set<string>();
  return DEFS.map((def) => {
    const { recipes, slots } = compose(def, used);
    for (const r of recipes) used.add(r.id);
    const m = members(def.household);
    const portions = m.reduce((s, x) => s + x.portion, 0);
    const scale = portions / 4;
    const { shopping, pantry } = groupShopping(recipes, scale);
    const activeTotal = recipes.reduce((s, r) => s + (r.activeMin ?? 0), 0);
    const modes = new Set(recipes.flatMap((r) => r.blocks.map((b) => b.mode)));
    const equipment = MODE_ORDER.filter((x) => modes.has(x)).map((x) => MODE_LABEL[x]!);
    return {
      slug: def.slug,
      path: `${EXAMPLES_BASE}/${def.slug}`,
      h1: def.h1,
      label: def.label,
      teaser: def.teaser,
      household: def.household,
      members: m,
      portions,
      scale,
      intro: intro(def, portions, slots, activeTotal),
      slots,
      shopping,
      pantry,
      activeTotal,
      equipment,
      vegetarianProteins: def.vegetarian
        ? slots.filter((s) => s.recipe.nutrition).map((s) => ({ name: displayName(s.recipe), protein: s.recipe.nutrition!.protein }))
        : null,
      faq: faq(def, portions, scale),
      snack: snackFor(def),
    };
  });
}

export const EXAMPLES: readonly ExampleView[] = buildExamples();
export const getExample = (slug: string) => EXAMPLES.find((e) => e.slug === slug) ?? null;

export type { Line };
