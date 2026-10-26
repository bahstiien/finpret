import type { RecipeView } from "./catalog";
import { RECIPES } from "./catalog";
import { MIN_MENUS_PER_HUB, MIN_RECIPES_PER_HUB } from "./config";
import { INDEXABLE_MENUS, pick, type Faq, type MenuView } from "./menus";

/** Pages hub thématiques : /batch-cooking/{theme}. Chaque hub filtre des menus et des recettes réels du catalogue. */

export type HubDef = {
  slug: string;
  h1: string;
  /** Titre court pour les liens. */
  label: string;
  intro: string[];
  faq: Faq[];
  recipe: (r: RecipeView) => boolean;
  menu: (m: MenuView) => boolean;
};

const sansFour = (r: RecipeView) => r.batch && !r.oven;

export const HUB_DEFS: readonly HubDef[] = [
  {
    slug: "en-2-heures",
    h1: "Batch cooking en 2 heures",
    label: "Batch cooking en 2 heures",
    intro: [
      "Deux heures suffisent pour préparer les dîners de la semaine si tu choisis des recettes à faible temps de travail et que tu enchaînes les cuissons : pendant qu'un plat mijote ou cuit au four, tu prépares le suivant.",
      "Les menus ci-dessous ont une session estimée à 2 heures ou moins, calculée à partir du travail actif de chaque recette et de l'ordre des cuissons. L'estimation suppose une seule personne en cuisine.",
    ],
    faq: [
      {
        q: "Peut-on vraiment cuisiner 5 dîners en 2 heures ?",
        a: "Oui avec des recettes courtes et un bon ordre : four et cuissons longues d'abord, découpes pendant que ça cuit. Chaque menu de cette page affiche sa durée estimée et son ordre de préparation.",
      },
      {
        q: "Par quoi commencer pendant la session ?",
        a: "Par les plats qui demandent le plus d'attente, souvent ceux du four, puis les cuissons à feu doux, puis les préparations froides.",
      },
      {
        q: "Combien de temps se gardent les plats ?",
        a: "La durée est indiquée sur chaque recette, de quelques jours au frigo, et beaucoup se congèlent.",
      },
    ],
    recipe: (r) => r.batch && r.activeMin <= 30,
    menu: (m) => m.combo.format === "batch" && (m.sessionMin ?? 999) <= 120,
  },
  {
    slug: "pour-debutant",
    h1: "Batch cooking pour débutant",
    label: "Batch cooking pour débutant",
    intro: [
      "Pour se lancer, mieux vaut des recettes simples, peu d'ingrédients et des gestes connus. Les recettes ci-dessous sont de difficulté 1 ou 2 sur 4 et se préparent sans matériel particulier.",
      "Commence par deux ou trois plats plutôt que cinq. Une fois à l'aise avec l'ordre des cuissons, passe à un menu complet.",
    ],
    faq: [
      {
        q: "Combien de plats pour une première session ?",
        a: "Deux ou trois suffisent. Choisis-en un au four et un à la poêle ou à la casserole pour que les cuissons se chevauchent.",
      },
      {
        q: "De quel matériel ai-je besoin ?",
        a: "Des plats allant au frigo et au congélateur, une plaque ou un plat à four, une casserole et une poêle. Chaque recette indique ses étapes.",
      },
      {
        q: "Comment ne pas me tromper dans l'ordre ?",
        a: "Les menus donnent un ordre de préparation : four et attentes longues d'abord.",
      },
    ],
    recipe: (r) => r.batch && r.difficulty <= 2,
    menu: (m) => m.combo.format === "batch" && m.recipes.every((r) => r.difficulty <= 2),
  },
  {
    slug: "famille",
    h1: "Batch cooking famille",
    label: "Batch cooking famille",
    intro: [
      "Pour une famille de 4 à 6 personnes, le batch cooking évite de se demander chaque soir quoi cuisiner. Les menus ci-dessous sont dimensionnés pour 4 ou 6 personnes et la liste de courses est consolidée.",
      "On y trouve des recettes accessibles, avec des plats de pâtes et de réconfort, et des tâches à confier aux enfants quand la recette en prévoit.",
    ],
    faq: [
      {
        q: "Les quantités conviennent-elles à des enfants ?",
        a: "Les recettes sont écrites pour 4 portions adultes. Les enfants mangent moins : tu peux acheter un peu moins ou garder des restes.",
      },
      {
        q: "Les enfants peuvent-ils aider ?",
        a: "Oui : certaines recettes indiquent une astuce ou une tâche adaptée aux enfants, comme écraser des bananes à la fourchette.",
      },
      {
        q: "Peut-on congeler pour les soirs chargés ?",
        a: "Beaucoup de plats se congèlent : la mention figure sur chaque recette.",
      },
    ],
    recipe: (r) => r.batch && r.difficulty <= 2 && (r.pasta || r.comfort || r.protein === "volaille" || r.vegetarian),
    menu: (m) => m.combo.format === "batch" && m.combo.persons >= 4,
  },
  {
    slug: "sans-four",
    h1: "Batch cooking sans four",
    label: "Batch cooking sans four",
    intro: [
      "Pas de four, ou pas envie de l'allumer : de nombreuses recettes de batch cooking se font entièrement à la poêle, à la casserole ou au micro-ondes. Les recettes de cette page n'utilisent jamais le four.",
      "Sans four, on chevauche les cuissons sur les feux : lance les plats les plus longs en premier et prépare les autres pendant qu'ils mijotent.",
    ],
    faq: [
      {
        q: "Peut-on faire du batch cooking sans four ?",
        a: "Oui. Les recettes listées ici se cuisinent sans four, uniquement sur le feu, au robot ou au micro-ondes.",
      },
      {
        q: "Combien de feux faut-il ?",
        a: "Deux ou trois suffisent pour enchaîner : un plat qui mijote, un autre qui saisit.",
      },
      {
        q: "Les plats se gardent-ils aussi bien ?",
        a: "Oui, la durée de conservation est indiquée sur chaque recette.",
      },
    ],
    recipe: sansFour,
    menu: (m) => m.combo.format === "batch" && m.recipes.every(sansFour),
  },
];

export type HubView = HubDef & {
  recipes: RecipeView[];
  menus: MenuView[];
  indexable: boolean;
  /** Nombre total de recettes du catalogue qui répondent au thème. */
  recipeCount: number;
};

function build(def: HubDef): HubView {
  const all = RECIPES.filter(def.recipe);
  const menus = INDEXABLE_MENUS.filter(def.menu);
  return {
    ...def,
    recipes: pick(all, `hub-${def.slug}`, 12),
    menus,
    recipeCount: all.length,
    indexable: all.length >= MIN_RECIPES_PER_HUB && menus.length >= MIN_MENUS_PER_HUB,
  };
}

export const HUBS: readonly HubView[] = HUB_DEFS.map(build);
export const getHub = (slug: string) => HUBS.find((h) => h.slug === slug) ?? null;
export const INDEXABLE_HUBS = HUBS.filter((h) => h.indexable);

/** Hub principal d'une recette, pour le maillage recette → hub. */
export const hubFor = (r: RecipeView) => INDEXABLE_HUBS.find((h) => h.recipe(r)) ?? null;
