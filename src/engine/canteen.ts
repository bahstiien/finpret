import { isPresentAt, type Member, type PresenceRule, weekParity } from "./portions";
import type { Library } from "./types";

/** Cantine (§13) : bases alimentaires, alerte doublon avec le dîner, et découpage d'un menu par date. */

/** Dictionnaire `FOOD_GROUPS` du prototype (bases détectées par mots-clés). */
export const FOOD_GROUPS: [string, string[]][] = [
  ["pâtes", ["pâte", "pates", "spaghetti", "coquillette", "macaroni", "lasagne", "tortellini", "ravioli", "penne", "torti"]],
  ["riz", ["riz", "risotto", "paella"]],
  ["poisson", ["poisson", "colin", "cabillaud", "saumon", "thon", "merlu", "lieu ", "hoki", "sardine", "maquereau"]],
  ["volaille", ["poulet", "dinde", "volaille", "nugget", "cordon"]],
  ["bœuf", ["bœuf", "boeuf", "steak", "haché", "bolognaise", "hachis", "chili", "boulette"]],
  ["porc", ["porc", "jambon", "saucisse", "lardon", "knack"]],
  ["œufs", ["omelette", "œuf", "oeuf", "quiche"]],
  ["pommes de terre", ["frite", "purée", "puree", "pomme de terre", "pommes de terre", "gratin dauphinois", "potatoes"]],
  ["pizza", ["pizza"]],
  ["légumineuses", ["lentille", "pois chiche", "haricots rouges", "flageolet"]],
];

/** `groupsOf` du prototype. */
export function groupsOf(text: string | null | undefined): string[] {
  const t = (text ?? "").toLowerCase();
  return FOOD_GROUPS.filter(([, keys]) => keys.some((k) => t.includes(k))).map(([g]) => g);
}

/** `recipeGroups` du prototype : nom de la recette et libellés de ses ingrédients. */
export function recipeGroups(lib: Pick<Library, "ingredients">, r: { n: string; ing?: Record<string, number> } | null | undefined) {
  if (!r) return [];
  return groupsOf([r.n, ...Object.keys(r.ing ?? {}).map((k) => lib.ingredients[k]?.l ?? k)].join(" "));
}

/** Bases communes au repas de la cantine et au dîner du même jour (alerte doublon). */
export function duplicateGroups(
  lib: Pick<Library, "ingredients">,
  canteenText: string,
  dinner: { n: string; ing?: Record<string, number> } | null | undefined,
): string[] {
  const dinnerGroups = recipeGroups(lib, dinner);
  return groupsOf(canteenText).filter((g) => dinnerGroups.includes(g));
}

/**
 * Jours de cantine d'un enfant : midis de semaine où il est absent alors qu'il dîne à la maison
 * (« Léo : cantine le midi en semaine », §5). 1 = lundi … 5 = vendredi.
 */
export function canteenDays(
  member: Pick<Member, "id" | "kind" | "archived">,
  presence: readonly PresenceRule[],
  weekStart: string,
  alternatingFrom?: string | null,
): number[] {
  if (member.kind !== "child" || member.archived) return [];
  const parity = weekParity(weekStart, alternatingFrom);
  return [1, 2, 3, 4, 5].filter(
    (d) => !isPresentAt(presence, member.id, d, "lunch", parity) && isPresentAt(presence, member.id, d, "dinner", parity),
  );
}

// ---------------------------------------------------------------------------
// Découpage d'un menu (texte d'un PDF) par date
// ---------------------------------------------------------------------------

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTH_RE = MONTHS.map((m) => m.replace("é", "[ée]").replace("û", "[uû]")).join("|");
const WEEKDAY_RE = "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche";

/** « Lundi 12 octobre », « lundi 12/10 », « 12/10/2026 », « Mardi 1er décembre 2026 ». */
const DATE_RE = new RegExp(
  `(?:(${WEEKDAY_RE})\\s+)?(\\d{1,2})(?:er)?(?:\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?|\\s*[/.-]\\s*(\\d{1,2})(?:\\s*[/.-]\\s*(\\d{2,4}))?)`,
  "giu",
);

export type DatedMenu = { date: string; text: string };

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Menus datés lus dans un texte libre. L'année manquante est celle qui place la date au plus près de `reference`.
 * Chaque menu est le texte entre sa date et la suivante, nettoyé. Les jours sans repas sont ignorés.
 */
export function splitByDate(text: string, reference: string): DatedMenu[] {
  const refYear = Number(reference.slice(0, 4));
  const refTime = Date.parse(`${reference}T12:00:00Z`);
  const hits: { index: number; end: number; date: string }[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const day = Number(m[2]);
    const month = m[3]
      ? MONTHS.findIndex((x) => x.normalize("NFD").replace(/\p{Diacritic}/gu, "") === m[3]!.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")) + 1
      : Number(m[5]);
    // Un nombre seul (« 2 œufs ») n'est pas une date : il faut un jour de la semaine, un mois écrit ou une barre.
    if (!m[1] && !m[3] && !m[5]) continue;
    if (!(day >= 1 && day <= 31 && month >= 1 && month <= 12)) continue;
    let year = Number(m[4] ?? m[6] ?? 0);
    if (year && year < 100) year += 2000;
    if (!year) {
      year = [refYear - 1, refYear, refYear + 1].reduce((best, y) =>
        Math.abs(Date.parse(`${iso(y, month, day)}T12:00:00Z`) - refTime) < Math.abs(Date.parse(`${iso(best, month, day)}T12:00:00Z`) - refTime) ? y : best,
      );
    }
    const date = iso(year, month, day);
    if (Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).getUTCDate() !== day) continue;
    hits.push({ index: m.index!, end: m.index! + m[0].length, date });
  }
  const out = new Map<string, string>();
  hits.forEach((h, i) => {
    const body = text
      .slice(h.end, hits[i + 1]?.index ?? text.length)
      .replace(/\s*\n\s*/g, ", ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s:,–-]+|[\s,;–-]+$/g, "")
      .trim();
    if (body.length >= 3 && !/^(f[ée]ri[ée]|pas de (repas|cantine)|ferm[ée])/i.test(body)) {
      out.set(h.date, out.has(h.date) ? `${out.get(h.date)}, ${body}` : body.slice(0, 300));
    }
  });
  return [...out].map(([date, t]) => ({ date, text: t })).sort((a, b) => a.date.localeCompare(b.date));
}
