import { ORIGINS } from "@/engine/origins";
import type { RecipeKind } from "./catalog";
import { DIFFICULTY_LABEL, fold, KIND_SHORT, type RecipeCard, type RecipeType, TYPES } from "./recipe-filter";

/**
 * Recherche « intelligente » de /recettes : lit une demande en français courant (« un plat italien réconfortant et
 * facile », « soupe de saison à congeler », « poulet en 20 min ») et en tire des filtres. Sans IA ni réseau : un lexique
 * de mots et d'expressions, avec pluriels et féminins. Les mots non reconnus restent une recherche dans le nom, le pays
 * et les ingrédients.
 */

/** Ce que la demande exprime ; tous les critères se cumulent. */
export type Intent = {
  kind?: RecipeKind;
  veg?: true;
  season?: true;
  freeze?: true;
  /** Un pays, ou tous ceux d'une région (« asiatique »). */
  countries?: string[];
  /** Difficulté de `[min, max]` (1 à 4) : « facile » couvre aussi « très facile ». */
  difficulty?: [number, number];
  types?: RecipeType[];
  maxMin?: number;
  /** Mois voulus (1 à 12) : « en hiver », « en mars ». */
  months?: number[];
};

/** Un morceau compris de la demande : son libellé, et la position de ses mots pour pouvoir le retirer. */
export type Hit = { label: string; tokens: number[] };

export type Understanding = { intent: Intent; hits: Hit[]; words: string[] };

type Entry = { phrase: string[]; intent: Intent; label: string };

const MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];
const MONTH_LABEL = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const SEASONS: [string, number[], string][] = [
  ["hiver", [12, 1, 2], "Hiver"],
  ["printemps", [3, 4, 5], "Printemps"],
  ["ete", [6, 7, 8], "Été"],
  ["automne", [9, 10, 11], "Automne"],
];

/** Adjectifs de nationalité (forme masculine, les variantes sont déduites). */
const ADJECTIVES: Record<string, string[]> = {
  fr: ["francais"],
  it: ["italien"],
  es: ["espagnol"],
  gr: ["grec", "grecque"],
  ma: ["marocain"],
  lb: ["libanais"],
  tn: ["tunisien"],
  in: ["indien"],
  th: ["thai", "thailandais"],
  jp: ["japonais"],
  kr: ["coreen"],
  cn: ["chinois"],
  mx: ["mexicain"],
  us: ["americain"],
  gb: ["anglais", "britannique"],
  be: ["belge"],
  hu: ["hongrois"],
  ch: ["suisse"],
  vn: ["vietnamien"],
};

const REGION_WORDS: Record<string, string[]> = {
  Asie: ["asie", "asiatique"],
  "Méditerranée et Orient": ["mediterranee", "mediterraneen", "oriental", "orient"],
  Amériques: ["amerique", "ameriques"],
  Europe: ["europe", "europeen"],
};

/** Mots qui ne portent pas de sens pour la recherche. */
const STOP = new Set(
  (
    "recette idee un une des de du d le la les l et ou avec pour a au aux en je j veux voudrais cherche envie " +
    "quelque chose plat repas ce cet cette soir midi cuisiner cuisine faire me moi mon ma mes qui que se bon bonne " +
    "petit petite truc tres bien plutot assez un peu style facon maison"
  ).split(" "),
);

const tokens = (phrase: string) => phrase.split(" ");

function buildLexicon(): Entry[] {
  const e: Entry[] = [];
  const add = (phrases: string[], intent: Intent, label: string) => {
    for (const p of phrases) e.push({ phrase: tokens(p), intent, label });
  };

  for (const [code, o] of Object.entries(ORIGINS)) {
    add([fold(o.name).replace(/-/g, " "), ...(ADJECTIVES[code] ?? [])], { countries: [o.name] }, o.name);
  }
  for (const [region, words] of Object.entries(REGION_WORDS)) {
    const countries = Object.values(ORIGINS)
      .filter((o) => o.region === region)
      .map((o) => o.name);
    add(words, { countries }, region);
  }

  add(["vegetarien", "vege", "veggie", "sans viande"], { veg: true }, "Végétarien");
  add(
    ["reconfortant", "reconfort", "doudou", "cocooning", "comfort food", "comfort", "regressif"],
    { types: ["reconfortant"] },
    TYPES.reconfortant,
  );
  add(["pates", "pasta"], { types: ["pates"] }, TYPES.pates);
  add(["au four", "four"], { types: ["four"] }, TYPES.four);
  add(["volaille", "poulet", "dinde"], { types: ["volaille"] }, TYPES.volaille);
  add(["boeuf"], { types: ["boeuf"] }, TYPES.boeuf);
  add(["porc", "cochon"], { types: ["porc"] }, TYPES.porc);
  add(["poisson"], { types: ["poisson"] }, TYPES.poisson);

  add(
    ["tres facile", "tres simple", "enfantin", "inratable", "debutant"],
    { difficulty: [1, 1] },
    DIFFICULTY_LABEL[0],
  );
  add(["facile", "simple", "sans difficulte"], { difficulty: [1, 2] }, DIFFICULTY_LABEL[1]);
  add(["intermediaire"], { difficulty: [3, 3] }, DIFFICULTY_LABEL[2]);
  add(["technique", "difficile", "elabore", "challenge"], { difficulty: [4, 4] }, DIFFICULTY_LABEL[3]);

  add(["soupe", "veloute", "potage", "bouillon"], { kind: "soupe" }, KIND_SHORT.soupe);
  add(
    ["gouter", "gateau", "dessert", "biscuit", "brioche", "crepe", "sucre"],
    { kind: "gouter" },
    KIND_SHORT.gouter,
  );
  add(["batch cooking", "batch", "a l avance", "en avance"], { kind: "plat" }, KIND_SHORT.plat);
  add(["diner express"], { kind: "simple" }, KIND_SHORT.simple);

  add(["rapide", "vite", "express", "presse", "minute", "rapidement"], { maxMin: 30 }, "Moins de 30 min");
  add(["de saison", "saison", "saisonnier", "du moment"], { season: true }, "De saison");
  for (const [w, months, label] of SEASONS) add([w], { months }, label);
  MONTHS.forEach((m, i) => add([m], { months: [i + 1] }, MONTH_LABEL[i]!));
  add(
    ["congeler", "congelable", "congelation", "congele", "congelateur", "surgeler"],
    { freeze: true },
    "Se congèle",
  );

  // Les expressions les plus longues d'abord : « très facile » avant « facile », « batch cooking » avant « batch ».
  return e.sort((a, b) => b.phrase.length - a.phrase.length);
}

const LEXICON = buildLexicon();

/** `italienne`, `italiens`, `pâtes` : pluriels et féminins réguliers. */
const same = (token: string, word: string) =>
  token === word ||
  (token.startsWith(word) && ["s", "e", "es", "ne", "nes", "x"].includes(token.slice(word.length)));

/** Découpe une demande en mots (même découpage pour comprendre et pour retirer un morceau compris). */
export const splitQuery = (q: string) => q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const DURATION = /^(\d{1,3})(?:min|mn|minutes?)?$/;
const MINUTES = /^(min|mn|minute|minutes)$/;

export function understand(q: string): Understanding {
  const raw = splitQuery(q);
  const words = raw.map(fold);
  const intent: Intent = {};
  const hits: Hit[] = [];
  const rest: string[] = [];

  /** Les listes (typologies, pays, mois) s'additionnent ; le reste remplace. */
  const merge = (add: Intent) => {
    Object.assign(intent, {
      ...add,
      types: add.types ? [...new Set([...(intent.types ?? []), ...add.types])] : intent.types,
      countries: add.countries
        ? [...new Set([...(intent.countries ?? []), ...add.countries])]
        : intent.countries,
      months: add.months ? [...new Set([...(intent.months ?? []), ...add.months])] : intent.months,
    });
  };

  let i = 0;
  while (i < words.length) {
    // « 20 min », « 20min », « moins de 45 minutes »
    const d = DURATION.exec(words[i]!);
    if (d && (words[i]!.length > d[1]!.length || MINUTES.test(words[i + 1] ?? ""))) {
      const n = Number(d[1]);
      const span = words[i]!.length > d[1]!.length ? 1 : 2;
      merge({ maxMin: n });
      hits.push({ label: `${n} min max`, tokens: Array.from({ length: span }, (_, k) => i + k) });
      i += span;
      continue;
    }
    const entry = LEXICON.find((e) =>
      e.phrase.every((w, k) => i + k < words.length && same(words[i + k]!, w)),
    );
    if (entry) {
      merge(entry.intent);
      hits.push({ label: entry.label, tokens: entry.phrase.map((_, k) => i + k) });
      i += entry.phrase.length;
      continue;
    }
    if (!STOP.has(words[i]!) && !/^(moins|max|maximum|environ)$/.test(words[i]!)) rest.push(words[i]!);
    i++;
  }
  // Deux libellés identiques (« facile et simple ») : un seul morceau, qui retire les deux.
  const merged: Hit[] = [];
  for (const h of hits) {
    const prev = merged.find((m) => m.label === h.label);
    if (prev) prev.tokens.push(...h.tokens);
    else merged.push(h);
  }
  return { intent, hits: merged, words: rest };
}

/** La demande sans un morceau compris (bouton × de la pastille). */
export function withoutHit(q: string, hit: Hit): string {
  return splitQuery(q)
    .filter((_, i) => !hit.tokens.includes(i))
    .join(" ");
}

type Resolved = Intent & { words: string[] };

function fits(r: RecipeCard, x: Resolved, month: number): boolean {
  if (x.kind && r.kind !== x.kind) return false;
  if (x.veg && !r.vegetarian) return false;
  if (x.freeze && !r.freezable) return false;
  if (x.season && r.months && !r.months.includes(month)) return false;
  if (x.months && r.months && !x.months.some((m) => r.months!.includes(m))) return false;
  if (x.countries && (!r.country || !x.countries.includes(r.country))) return false;
  if (x.difficulty && (r.difficulty < x.difficulty[0] || r.difficulty > x.difficulty[1])) return false;
  if (x.types?.some((t) => !r.types.includes(t))) return false;
  if (x.maxMin && r.kind !== "simple" && (r.totalMin == null || r.totalMin > x.maxMin)) return false;
  return x.words.every((w) => r.text.includes(w));
}

export type SearchResult = {
  recipes: RecipeCard[];
  understood: Understanding;
  /** Mots absents de tout le catalogue (faute de frappe, mot de liaison) : ignorés plutôt que de tout vider. */
  ignored: string[];
};

/** `month` de 1 à 12 (« de saison »). Une recette sans mois est de saison toute l'année. */
export function search(recipes: readonly RecipeCard[], q: string, month: number): SearchResult {
  const understood = understand(q);
  const known = understood.words.filter((w) => recipes.some((r) => r.text.includes(w)));
  const x: Resolved = { ...understood.intent, words: known };
  return {
    recipes: recipes.filter((r) => fits(r, x, month)),
    understood,
    ignored: understood.words.filter((w) => !known.includes(w)),
  };
}
