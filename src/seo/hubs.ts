import type { RecipeView } from "./catalog";
import { RECIPES } from "./catalog";
import { MIN_MENUS_PER_HUB, MIN_RECIPES_PER_HUB } from "./config";
import { EXAMPLES } from "./exemples";
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
    slug: "pour-debutant",
    h1: "Batch cooking pour débutant",
    label: "Batch cooking pour débutant",
    intro: [
      "Les recettes ci-dessous sont de difficulté 1 ou 2 sur 4 dans le catalogue Fin Prêt.",
      "Les étapes, les durées et la conservation de chaque plat sont indiqués sur sa page.",
    ],
    faq: [
      {
        q: "Comment la difficulté est-elle indiquée ?",
        a: "Chaque recette du catalogue a une difficulté de 1 (très facile) à 4 (technique).",
      },
      {
        q: "Combien de temps se gardent les plats ?",
        a: "La durée de conservation au frigo est indiquée sur chaque recette, ainsi que la possibilité de congeler.",
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
      "Des recettes de difficulté 1 ou 2 : plats de pâtes, plats réconfort, volaille ou végétariens, à partir du catalogue Fin Prêt.",
      "Chaque recette est écrite pour 4 portions adultes ; dans l'application, la portion d'un enfant dépend de son âge.",
    ],
    faq: [
      {
        q: "Comment sont comptées les portions des enfants ?",
        a: "Un adulte compte 1 portion. Un enfant compte 0,33 portion avant 3 ans, 0,5 de 3 à 6 ans, 0,75 de 7 à 11 ans et 1 à partir de 12 ans.",
      },
      {
        q: "Les enfants peuvent-ils aider ?",
        a: "Les goûters du catalogue indiquent une tâche adaptée aux enfants, comme écraser des bananes à la fourchette.",
      },
      {
        q: "Peut-on congeler ?",
        a: "La mention « se congèle » figure sur chaque recette concernée.",
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
      "Les recettes de cette page n'ont aucune étape au four : elles se cuisinent sur le feu, au robot ou au micro-ondes, selon la recette.",
      "Le mode de cuisson de chaque étape est indiqué sur la page de la recette.",
    ],
    faq: [
      {
        q: "Quelles recettes se font sans four ?",
        a: "Celles listées ici : aucune de leurs étapes n'utilise le four.",
      },
      {
        q: "Combien de temps se gardent les plats ?",
        a: "La durée de conservation est indiquée sur chaque recette.",
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
  // Les menus générés sont en noindex : la page renvoie alors vers les exemples de semaine, qui sont indexables.
  const weeks = menus.length || EXAMPLES.length;
  return {
    ...def,
    recipes: pick(all, `hub-${def.slug}`, 12),
    menus,
    recipeCount: all.length,
    indexable: all.length >= MIN_RECIPES_PER_HUB && weeks >= MIN_MENUS_PER_HUB,
  };
}

export const HUBS: readonly HubView[] = HUB_DEFS.map(build);
export const getHub = (slug: string) => HUBS.find((h) => h.slug === slug) ?? null;
export const INDEXABLE_HUBS = HUBS.filter((h) => h.indexable);

/** Hub principal d'une recette, pour le maillage recette → hub. */
export const hubFor = (r: RecipeView) => INDEXABLE_HUBS.find((h) => h.recipe(r)) ?? null;
