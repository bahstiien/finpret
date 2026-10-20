import type { Ingredient } from "../catalog/schema";
import type { ParsedLine } from "./ingredient-line";

/**
 * Rapprochement d'une ligne avec le catalogue (§8.8, étape 4) : correspondance exacte, puis synonymes, puis
 * similarité (seuil 0,85). Les 5 meilleurs candidats servent au menu déroulant et au modèle de langage.
 */

/**
 * Synonymes courants vers les ingrédients du catalogue (rapprochement, pas de donnée nutritionnelle).
 * Complétés par la table ingredient_synonyms. TODO(spec) : liste à enrichir avec les imports réels.
 */
export const BUILTIN_SYNONYMS: Record<string, string> = {
  "tomates pelees": "tomates",
  "tomates concassees": "tomates",
  "tomate pelee": "tomates",
  "pulpe de tomate": "tomates",
  "coulis de tomate": "passata",
  "sauce tomate": "passata",
  "passata de tomate": "passata",
  "huile d olive": "huile",
  "huile olive": "huile",
  "huile vegetale": "huileneutre",
  "huile de tournesol": "huileneutre",
  "huile de colza": "huileneutre",
  "creme fraiche": "creme",
  "creme liquide": "creme",
  "creme fraiche epaisse": "creme",
  "creme entiere": "creme",
  oeuf: "oeufs",
  "beurre doux": "beurre",
  "beurre demi sel": "beurre",
  "gruyere rape": "emmental",
  "fromage rape": "emmental",
  "emmental rape": "emmental",
  "parmesan rape": "parmesan",
  "lardons fumes": "lardons",
  "blanc de poulet": "poulet",
  "filet de poulet": "poulet",
  "escalope de poulet": "poulet",
  "poulet": "poulet",
  "cuisse de poulet": "cuisse",
  "viande hachee": "boeuf",
  "boeuf hache": "boeuf",
  "steak hache": "steak",
  oignon: "oignon",
  "oignon jaune": "oignon",
  "oignon rouge": "oignon",
  "pomme de terre": "pommedeterre",
  "levure chimique": "levure",
  "sachet de levure": "levure",
  "levure boulangere": "levureboul",
  "levure de boulanger": "levureboul",
  "bouillon cube": "bouillon",
  "cube de bouillon": "bouillon",
  "bouillon de volaille": "bouillon",
  "lait demi ecreme": "lait",
  "lait entier": "lait",
  "sucre en poudre": "sucre",
  "sucre semoule": "sucre",
  "farine de ble": "farine",
  "gousse d ail": "ail",
  "lait de coco": "laitcoco",
  "pois chiche": "poischiches",
  "lentille corail": "lentillescorail",
  "lentille verte": "lentillesvertes",
  "pate brisee": "patebrisee",
  "pate feuilletee": "patefeuilletee",
  "pate a pizza": "pizza",
  "feuille de lasagne": "pateslasagnes",
  "thon au naturel": "thon",
  "dos de cabillaud": "cabillaud",
  "pave de saumon": "saumon",
  "saumon": "saumon",
  "chocolat noir": "chocolat",
  "poudre d amande": "amande",
  "amande en poudre": "amande",
  "flocon d avoine": "flocons",
  "sauce soja": "soja",
  "concentre de tomate": "tomates",
};

/** Mots qui ne changent pas l'ingrédient acheté. */
const STOP = new Set(["de", "d", "du", "des", "la", "le", "les", "l", "a", "au", "aux", "en", "bio", "frais", "fraiche", "fraiches", "gros", "grosse", "petit", "petits", "petite", "bien", "mur", "murs", "mure", "mures", "entier", "entiers", "extra", "vierge", "surgele", "surgeles"]);

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 ? w.replace(/(s|x)$/, "") : w))
    .join(" ")
    .trim();
}

/** Similarité de Dice sur les bigrammes de lettres (0 à 1). */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ga = grams(a);
  const gb = grams(b);
  let inter = 0;
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0);
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

export type Candidate = { key: string; label: string; score: number };
export type MatchResult = {
  key: string | null;
  method: "exact" | "synonym" | "similarity" | null;
  score: number;
  candidates: Candidate[];
};

export const SIMILARITY_THRESHOLD = 0.85;

/**
 * @param ingredients catalogue global et ingrédients du foyer
 * @param synonyms synonymes (intégrés et table ingredient_synonyms), normalisés ou non
 */
export function matchIngredient(
  line: Pick<ParsedLine, "label">,
  ingredients: Record<string, Pick<Ingredient, "l">>,
  synonyms: Record<string, string> = BUILTIN_SYNONYMS,
): MatchResult {
  const target = normalize(line.label);
  const entries = Object.entries(ingredients).map(([key, g]) => ({ key, label: g.l, norm: normalize(g.l), keyNorm: normalize(key) }));
  const syn = Object.entries(synonyms).map(([k, v]) => [normalize(k), v] as const);

  const scored = entries
    .map((e) => {
      // Les mots du libellé du catalogue présents dans la ligne comptent autant que la similarité globale.
      const words = e.norm.split(" ");
      const contained = words.every((w) => target.split(" ").includes(w)) ? 0.9 + 0.1 * (words.length / Math.max(1, target.split(" ").length)) : 0;
      return { key: e.key, label: e.label, score: Math.max(dice(target, e.norm), dice(target, e.keyNorm), contained) };
    })
    .sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 5).map((c) => ({ ...c, score: Math.round(c.score * 100) / 100 }));

  const exact = entries.find((e) => e.norm === target || e.keyNorm === target.replace(/ /g, ""));
  if (exact) return { key: exact.key, method: "exact", score: 1, candidates };
  const bySyn = syn.find(([k]) => k === target) ?? syn.find(([k]) => target.startsWith(`${k} `) || target.endsWith(` ${k}`));
  if (bySyn && ingredients[bySyn[1]]) return { key: bySyn[1], method: "synonym", score: 0.95, candidates };
  const best = scored[0];
  if (best && best.score >= SIMILARITY_THRESHOLD) return { key: best.key, method: "similarity", score: best.score, candidates };
  return { key: null, method: null, score: best?.score ?? 0, candidates };
}

/** Clé d'un ingrédient créé pour le foyer : stable, lisible, sans collision avec le catalogue. */
export const householdIngredientKey = (householdId: string, label: string) =>
  `h_${householdId.replace(/-/g, "").slice(0, 8)}_${normalize(label).replace(/ /g, "_").slice(0, 30) || "ingredient"}`;
