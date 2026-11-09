import { AISLE_KEYWORDS } from "./aisle-keywords";
import { EXTRAS, type Extra } from "./extras-catalog";

/**
 * Articles hors menu (§8.3) : recherche dans la bibliothèque et dans les habitudes du foyer, rayon d'un article
 * saisi librement, saisie « 6 yaourts » découpée en nom et quantité. Pur, sans accès à la base.
 */

const STOP = new Set([
  "de",
  "d",
  "du",
  "des",
  "la",
  "le",
  "les",
  "l",
  "a",
  "au",
  "aux",
  "en",
  "et",
  "pour",
  "un",
  "une",
]);

/** Minuscules, sans accents ni ligatures, ponctuation en espaces. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mots significatifs, au singulier approximatif (« yaourts » → « yaourt », « gâteaux » → « gateau »). */
export function words(s: string) {
  return normalize(s)
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w));
}

/** Habitude du foyer : un article déjà ajouté à la main, son dernier rayon et le nombre de semaines où il revient. */
export type Habit = { label: string; aisle: string; count: number };

/** Regroupe les articles ajoutés à la main (les plus récents d'abord) en habitudes, les plus fréquentes d'abord. */
export function habitsFrom(rows: readonly { label: string | null; aisle: string }[]): Habit[] {
  const byKey = new Map<string, Habit>();
  for (const r of rows) {
    if (!r.label?.trim()) continue;
    const k = normalize(r.label);
    const h = byKey.get(k);
    if (h) h.count++;
    else byKey.set(k, { label: r.label.trim(), aisle: r.aisle, count: 1 });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}

/** Score d'une écriture candidate pour une recherche : 0 si un mot cherché n'y commence aucun mot. */
function score(q: string[], qNorm: string, text: string) {
  const n = normalize(text);
  if (n === qNorm) return 100;
  const w = words(text);
  if (!q.length || !w.length) return 0;
  if (!q.every((t) => w.some((x) => x.startsWith(t)))) return 0;
  let s = 50;
  if (w[0]!.startsWith(q[0]!)) s += 25;
  if (n.startsWith(qNorm)) s += 10;
  // À pertinence égale, l'écriture la plus courte (la plus proche de ce qui est tapé) passe devant.
  return s - Math.min(9, w.length - q.length);
}

export type Suggestion = { label: string; aisle: string; from: "habit" | "catalog" };

/**
 * Propositions pour ce qui est tapé : habitudes du foyer d'abord à pertinence voisine, puis la bibliothèque,
 * sans doublon de nom. Vide tant que rien de significatif n'est tapé.
 */
export function searchExtras(
  query: string,
  habits: readonly Habit[] = [],
  limit = 6,
  catalog: readonly Extra[] = EXTRAS,
): Suggestion[] {
  const qNorm = normalize(query);
  const q = words(query);
  if (!q.length) return [];
  const seen = new Set<string>();
  const out: (Suggestion & { s: number })[] = [];
  for (const h of habits) {
    const s = score(q, qNorm, h.label);
    if (!s) continue;
    seen.add(normalize(h.label));
    out.push({ label: h.label, aisle: h.aisle, from: "habit", s: s + 15 + Math.min(10, h.count) });
  }
  for (const e of catalog) {
    if (seen.has(normalize(e.label))) continue;
    const s = Math.max(score(q, qNorm, e.label), ...(e.also ?? []).map((a) => score(q, qNorm, a) - 5));
    if (s > 0) out.push({ label: e.label, aisle: e.aisle, from: "catalog", s });
  }
  return out
    .sort((a, b) => b.s - a.s || a.label.length - b.label.length)
    .slice(0, limit)
    .map(({ label, aisle, from }) => ({ label, aisle, from }));
}

/** Article connu sous ce nom exact (habitude du foyer, nom ou autre écriture de la bibliothèque : « pq »). */
export function findExtra(
  label: string,
  habits: readonly Habit[] = [],
  catalog: readonly Extra[] = EXTRAS,
): { label: string; aisle: string } | null {
  const n = normalize(label);
  if (!n) return null;
  const habit = habits.find((h) => normalize(h.label) === n);
  if (habit) return habit;
  const e =
    catalog.find((x) => normalize(x.label) === n) ??
    catalog.find((x) => x.also?.some((a) => normalize(a) === n));
  return e ? { label: e.label, aisle: e.aisle } : null;
}

/**
 * Rayon d'un article saisi librement : celui où le foyer l'a déjà rangé, sinon celui de la bibliothèque
 * (même nom, puis même mot principal), sinon les mots-clés du prototype, sinon « divers ».
 */
export function classify(label: string, habits: readonly Habit[] = [], catalog: readonly Extra[] = EXTRAS) {
  const n = normalize(label);
  const known = findExtra(label, habits, catalog);
  if (known) return known.aisle;

  // Le premier mot porte le sens en français (« yaourts vanille », « gel douche bio ») : il compte le plus.
  const q = words(label);
  let best: { aisle: string; s: number } | null = null;
  for (const e of catalog) {
    for (const [text, bonus] of [[e.label, 1] as const, ...(e.also ?? []).map((a) => [a, 0] as const)]) {
      const w = words(text);
      let s = 0;
      q.forEach((t, i) => {
        if (w.includes(t)) s += (q.length - i) * 10;
      });
      if (!s) continue;
      s += bonus - w.length * 0.1;
      if (!best || s > best.s) best = { aisle: e.aisle, s };
    }
  }
  if (best) return best.aisle;

  // Mots-clés du prototype, au début d'un mot seulement (« vaisselle » ne contient pas « sel »).
  const padded = ` ${n} `;
  for (const [aisle, keywords] of AISLE_KEYWORDS)
    if (keywords.some((k) => padded.includes(` ${normalize(k)}`))) return aisle;
  return "divers";
}

const UNIT = "(?:kg|g|l|cl|ml|x|×|paquets?|packs?|boites?|boîtes?|bouteilles?|sachets?|pots?)";

/**
 * Découpe une saisie en nom et quantité : « 6 yaourts », « 2 kg de pommes », « Lait x6 ».
 * Un nombre au milieu du nom (« Couches taille 4 ») reste dans le nom.
 */
export function parseEntry(text: string): { label: string; qty: string } {
  const t = text.trim().replace(/\s+/g, " ");
  const lead = t.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT})?\\s+(?:(?:de|d')\\s*)?(.+)$`, "i"));
  if (lead) return { label: cap(lead[3]!), qty: [lead[1], lead[2]].filter(Boolean).join(" ") };
  const tail = t.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
  if (tail) return { label: cap(tail[1]!), qty: tail[2]! };
  return { label: cap(t), qty: "" };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Propositions d'emblée : les habitudes du foyer, complétées par les incontournables de la bibliothèque. */
export function quickPicks(
  habits: readonly Habit[],
  max = 12,
  catalog: readonly Extra[] = EXTRAS,
): Suggestion[] {
  const out: Suggestion[] = habits
    .slice(0, max)
    .map((h) => ({ label: h.label, aisle: h.aisle, from: "habit" }));
  const seen = new Set(out.map((s) => normalize(s.label)));
  // Un incontournable par rayon à tour de rôle : des fruits aux couches, plutôt que douze fruits.
  const byAisle = new Map<string, Extra[]>();
  for (const e of catalog)
    if (e.top && !seen.has(normalize(e.label))) byAisle.set(e.aisle, [...(byAisle.get(e.aisle) ?? []), e]);
  const queues = [...byAisle.values()];
  for (let round = 0; out.length < max && queues.some((q) => q.length > round); round++)
    for (const q of queues) {
      if (out.length >= max) break;
      const e = q[round];
      if (e) out.push({ label: e.label, aisle: e.aisle, from: "catalog" });
    }
  return out;
}

/** Bibliothèque d'un rayon, dans l'ordre où elle est écrite (les incontournables d'abord). */
export function extrasOf(aisle: string, catalog: readonly Extra[] = EXTRAS) {
  const items = catalog.filter((e) => e.aisle === aisle);
  return [...items.filter((e) => e.top), ...items.filter((e) => !e.top)];
}
