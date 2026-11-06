import type { RecipeKind, RecipeView } from "./catalog";
import type { RecipePhoto } from "./images";

/**
 * Recherche de la page publique /recettes : fonctions pures, partagées par la page (serveur) et la liste (client).
 * La demande en langage courant (`q`) est interprétée par `recipe-intent.ts`.
 */

export const KIND_SHORT: Record<RecipeKind, string> = {
  plat: "Batch cooking",
  soupe: "Soupe",
  simple: "Dîner express",
  gouter: "Goûter",
};

/** Niveaux de difficulté du seed (1 à 4), dans les mots de la fiche recette. */
export const DIFFICULTY_LABEL = ["Très facile", "Facile", "Intermédiaire", "Technique"] as const;

/** Typologies : ambiance du plat (réconfortant, pâtes, au four) ou protéine principale. */
export const TYPES = {
  reconfortant: "Réconfortant",
  pates: "Pâtes",
  four: "Au four",
  volaille: "Volaille",
  boeuf: "Bœuf",
  porc: "Porc",
  poisson: "Poisson",
} as const;
export type RecipeType = keyof typeof TYPES;

/** 10 par page : 5 lignes de 2 sur mobile, 2 lignes de 5 sur grand écran, toujours des lignes pleines. */
export const PAGE_SIZE = 10;

export const pageCount = (n: number) => Math.max(1, Math.ceil(n / PAGE_SIZE));

/** Ce qu'il faut à une tuile et aux filtres : la liste part dans la page, on n'envoie pas la recette entière. */
export type RecipeCard = {
  slug: string;
  name: string;
  kind: RecipeKind;
  vegetarian: boolean;
  freezable: boolean;
  months: number[] | null;
  photo: RecipePhoto | null;
  country: string | null;
  difficulty: number;
  types: RecipeType[];
  /** Durée totale en minutes ; null pour les dîners express, rapides par définition. */
  totalMin: number | null;
  /** Nom, pays et ingrédients, sans accents ni majuscules. */
  text: string;
};

/** État de la recherche, dans l'URL (`?q=…&page=2`) pour qu'elle se partage. */
export type RecipeFilter = {
  q: string;
  /** Numéro de page, à partir de 1. */
  page: number;
};

export const NO_FILTER: RecipeFilter = { q: "", page: 1 };

export const fold = (s: string) =>
  s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/\p{M}/gu, "");

function typesOf(r: RecipeView): RecipeType[] {
  const t: RecipeType[] = [];
  if (r.comfort) t.push("reconfortant");
  if (r.pasta) t.push("pates");
  if (r.oven) t.push("four");
  if (r.protein && r.protein !== "veg") t.push(r.protein as RecipeType);
  return t;
}

export function toCard(r: RecipeView, name: string): RecipeCard {
  return {
    slug: r.slug,
    name,
    kind: r.kind,
    vegetarian: r.vegetarian,
    freezable: r.freezable,
    months: r.months,
    photo: r.photo,
    country: r.country,
    difficulty: r.difficulty,
    types: typesOf(r),
    totalMin: r.totalMin,
    text: fold([name, r.name, r.country ?? "", ...r.ingredients.map((i) => i.label)].join(" ")),
  };
}

export function parseFilter(params: URLSearchParams): RecipeFilter {
  return {
    q: params.get("q") ?? "",
    page: Math.max(1, Math.floor(Number(params.get("page"))) || 1),
  };
}

export function filterQuery(f: RecipeFilter): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
