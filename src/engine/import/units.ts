/** Durées ISO 8601, nombre de portions et conversions d'unités (§8.8, étapes 4 et 5). */

/** « PT1H30M » → 90 ; « P0DT0H20M » → 20 ; null si illisible. */
export function isoMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = iso
    .trim()
    .match(
      /^P(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i,
    );
  if (!m || iso.trim().toUpperCase() === "P" || iso.trim().toUpperCase() === "PT") return null;
  const n = (v?: string) => (v ? Number(v.replace(",", ".")) : 0);
  const total = n(m[1]) * 1440 + n(m[2]) * 60 + n(m[3]) + n(m[4]) / 60;
  return Math.round(total);
}

/**
 * Portions à partir de `recipeYield` : « 4 », « 4 personnes », « 6-8 parts » (on retient le plus petit nombre,
 * soit la portion la plus généreuse), « Pour 2 à 3 personnes ». null si absent (on demande à l'utilisateur).
 */
export function parseYield(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const m = String(raw).match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  return n > 0 && n <= 50 ? n : null;
}

export type CatalogUnit = "g" | "ml" | "pc" | "boite" | "cs" | "cc";

/** Unité lue dans une ligne d'ingrédient, et sa conversion vers une unité du catalogue. */
export type UnitInfo = { unit: CatalogUnit; factor: number };

/** 1 cs = 15 ml, 1 cc = 5 ml, 1 verre = 200 ml, 1 l = 1 000 ml, 1 kg = 1 000 g (§8.8). */
export const UNIT_WORDS: [RegExp, UnitInfo][] = [
  [/^(kg|kilos?|kilogrammes?)$/i, { unit: "g", factor: 1000 }],
  [/^(g|gr|grammes?)$/i, { unit: "g", factor: 1 }],
  [/^(mg|milligrammes?)$/i, { unit: "g", factor: 0.001 }],
  [/^(l|litres?)$/i, { unit: "ml", factor: 1000 }],
  [/^(dl|décilitres?)$/i, { unit: "ml", factor: 100 }],
  [/^(cl|centilitres?)$/i, { unit: "ml", factor: 10 }],
  [/^(ml|millilitres?)$/i, { unit: "ml", factor: 1 }],
  [/^(verres?)$/i, { unit: "ml", factor: 200 }],
  [/^(tasses?|bols?)$/i, { unit: "ml", factor: 250 }],
  [
    /^(c\.?\s?à\.?\s?s\.?|c\.?\s?s\.?|cs|cas|càs|cuill?(?:è|e)res?\s+à\s+soupe|cuill?\.?\s+à\s+soupe|c\.\s?à\s?soupe)$/i,
    { unit: "cs", factor: 1 },
  ],
  [
    /^(c\.?\s?à\.?\s?c\.?|c\.?\s?c\.?|cc|cac|càc|cuill?(?:è|e)res?\s+à\s+café|cuill?\.?\s+à\s+café|c\.\s?à\s?café)$/i,
    { unit: "cc", factor: 1 },
  ],
  [/^(boîtes?|boites?|conserves?)$/i, { unit: "boite", factor: 1 }],
];

/** Mots qui comptent des pièces (« 3 gousses d'ail », « 2 tranches de jambon ») : l'unité du catalogue décide. */
export const PIECE_WORDS =
  /^(gousses?|tranches?|feuilles?|brins?|branches?|bottes?|bouquets?|pincées?|filets?|morceaux?|sachets?|pots?|paquets?|briques?|pavés?|boules?|rouleaux?|tiges?|têtes?|poignées?|zestes?|cubes?|tablettes?|barquettes?|bocaux?|bocal|noix|noisettes?|petits?|gros|grosses?|grandes?|moyens?|moyennes?)$/i;
