import { decodeEntities } from "./jsonld";
import { type CatalogUnit, PIECE_WORDS, UNIT_WORDS } from "./units";

/** Analyse d'une ligne d'ingrédient (§8.8, étape 4) : quantité, unité et libellé. */

export type ParsedLine = {
  original: string;
  qty: number | null;
  /** Unité convertie vers le catalogue (g, ml, cs, cc, boite), null si pièces ou sans unité. */
  unit: CatalogUnit | null;
  /** Mot de pièce (« gousses », « tranches »), utile pour l'affichage. */
  pieceWord: string | null;
  label: string;
  /** Précisions : parenthèses (« 400 g ») et ce qui suit une virgule (« émincé »). */
  note: string | null;
  /** « Sel, poivre », « au goût », « quelques feuilles » : ingrédient de placard sans quantité. */
  toTaste: boolean;
  /** Autre mesure donnée entre parenthèses (« 1 boîte (400 g) »), pour toute la ligne. */
  alt: { qty: number; unit: CatalogUnit } | null;
};

const FRACTIONS: Record<string, string> = { "½": " 1/2", "¼": " 1/4", "¾": " 3/4", "⅓": " 1/3", "⅔": " 2/3", "⅛": " 1/8" };

const toNumber = (s: string): number => {
  const t = s.trim().replace(",", ".");
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
};

const WORD_NUMBERS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, huit: 8, dix: 10, douze: 12, demi: 0.5, "demi-": 0.5 };
const TO_TASTE = /(?<!\p{L})(au goût|selon (?:votre|ton|le) goût|à volonté|q\.?\s?s\.?|quantité suffisante|facultatif)(?!\p{L})/iu;
const TASTE_WORDS = /^(sel|poivre|fleur de sel|sel et poivre|sel, poivre|poivre du moulin|piment d'espelette|muscade|quelques?|un peu|une pincée|1 pincée|pincée)\b/i;

const PINCH = /\bpinc(é|e)es?(?!\p{L})|\bune? peu\b/iu;

/** Retire les articles et prépositions de tête : « de », « d' », « du », « des », « de la ». */
const stripArticles = (s: string) => s.replace(/^(?:de la |de l'|de l’|des |du |de |d'|d’|la |le |les |l'|l’)/i, "").trim();

export function parseIngredientLine(raw: string): ParsedLine {
  const original = decodeEntities(raw).trim();
  let s = original;
  for (const [k, v] of Object.entries(FRACTIONS)) s = s.replaceAll(k, v);
  s = s.replace(/\s+/g, " ").trim();

  // Précisions entre parenthèses.
  const notes: string[] = [];
  s = s.replace(/\(([^)]*)\)/g, (_, n: string) => {
    if (n.trim()) notes.push(n.trim());
    return " ";
  });
  s = s.replace(/\s+/g, " ").trim();

  // Unités collées au nombre : « 200g », « 20cl ».
  s = s.replace(/(\d)(kg|g|gr|mg|ml|cl|dl|l)\b/gi, "$1 $2");

  // Quantité en tête (chiffres, fraction, fourchette, ou nombre en lettres).
  let qty: number | null = null;
  const q = s.match(/^(?:environ |env\. |~)?(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*(?:à|-|–|ou)\s*\d+(?:[.,]\d+)?)?\s*/i);
  if (q) {
    qty = toNumber(q[1]!);
    s = s.slice(q[0].length);
  } else {
    const w = s.match(/^(un|une|deux|trois|quatre|cinq|six|huit|dix|douze|demi-?)\s+/i);
    if (w && !/^une? (pincée|peu)\b/i.test(s)) {
      qty = WORD_NUMBERS[w[1]!.toLowerCase()] ?? null;
      s = s.slice(w[0].length);
    }
  }

  // Unité (jusqu'à 4 mots : « cuillères à soupe »).
  let unit: CatalogUnit | null = null;
  let pieceWord: string | null = null;
  if (qty !== null) {
    const words = s.split(" ");
    for (let n = Math.min(4, words.length); n >= 1; n--) {
      const candidate = words.slice(0, n).join(" ").replace(/[.,]$/, "");
      const hit = UNIT_WORDS.find(([re]) => re.test(candidate));
      if (hit) {
        unit = hit[1].unit;
        qty = qty * hit[1].factor;
        s = words.slice(n).join(" ");
        break;
      }
    }
    if (!unit) {
      const first = s.split(" ")[0] ?? "";
      if (PIECE_WORDS.test(first) && s.split(" ").length > 1) {
        pieceWord = first.toLowerCase();
        s = s.slice(first.length).trim();
      }
    }
  }

  s = stripArticles(s.trim());
  // Ce qui suit une virgule ou un tiret est une précision (« oignon, émincé »), sauf « sel, poivre ».
  const comma = s.search(/,| - /);
  if (comma > 0 && !TASTE_WORDS.test(s)) {
    notes.push(s.slice(comma + 1).replace(/^-?\s*/, "").trim());
    s = s.slice(0, comma).trim();
  }
  const label = s.replace(/[.;:]+$/, "").trim();
  const toTaste =
    TO_TASTE.test(original) || PINCH.test(original) || (qty === null && (TASTE_WORDS.test(original) || !label));

  // « 1 potimarron (environ 1 kg) » : la masse entre parenthèses, utile si l'ingrédient se compte en grammes.
  const inner = notes.map((n) => n.match(/^(?:environ |env\. |~)?(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b/i)).find(Boolean);
  const alt = inner
    ? (() => {
        const info = UNIT_WORDS.find(([re]) => re.test(inner[2]!))![1];
        return { qty: Number(inner[1]!.replace(",", ".")) * info.factor * (qty ?? 1), unit: info.unit };
      })()
    : null;

  return {
    original,
    alt,
    qty: qty !== null && Number.isFinite(qty) ? Math.round(qty * 100) / 100 : null,
    unit,
    pieceWord,
    label: label || original,
    note: notes.filter(Boolean).join(" ; ") || null,
    toTaste,
  };
}
