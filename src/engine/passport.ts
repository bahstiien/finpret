/** Passeport des saveurs (SPEC_PROGRES §4). TypeScript pur. */

export type CookKind = "main" | "soup" | "simple";
export type Season = "winter" | "spring" | "summer" | "autumn";

export interface CookRecord {
  recipeId: string;
  cookedOn: string; // ISO date
  kind: CookKind;
  origin: string | null;
  /** Recette du catalogue global (household_id null). Les recettes privées ne comptent pas. */
  isGlobal: boolean;
  months?: number[];
  variantMonths?: number[][]; // `m` de chaque variante saisonnière `sv`
}

export interface CountryStamp {
  code: string;
  recipeIds: string[];
  firstCookedOn: string;
}

export const SEASON_STAMP_THRESHOLD = 6;

/** Origines du catalogue qui ne sont pas des pays valides ou mal codées (migration de données G1). */
export const ORIGIN_FIXES: Record<string, string | null> = { as: null, uk: "gb" };
export const normalizeOrigin = (o: string | null | undefined): string | null =>
  o == null ? null : o in ORIGIN_FIXES ? (ORIGIN_FIXES[o] ?? null) : o;

/** Code ISO 3166-1 alpha-2 connu de `Intl.DisplayNames`. */
export function isIsoRegion(code: string): boolean {
  if (!/^[a-z]{2}$/.test(code)) return false;
  try {
    const upper = code.toUpperCase();
    const name = new Intl.DisplayNames(["fr"], { type: "region", fallback: "none" }).of(upper);
    return name !== undefined && name !== upper;
  } catch {
    return false;
  }
}

export const countryLabel = (code: string): string =>
  new Intl.DisplayNames(["fr"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();

/** Saison d'une date ; l'hiver porte l'année de son mois de janvier. */
export function seasonOf(isoDate: string): { season: Season; year: number; key: string } {
  const [y = 0, m = 1] = isoDate.split("-").map(Number);
  let season: Season;
  let year = y;
  if (m === 12 || m <= 2) {
    season = "winter";
    if (m === 12) year = y + 1;
  } else if (m <= 5) season = "spring";
  else if (m <= 8) season = "summer";
  else season = "autumn";
  return { season, year, key: `${year}-${season}` };
}

export function isSeasonalIn(cook: Pick<CookRecord, "months" | "variantMonths">, month: number): boolean {
  if (cook.months && cook.months.length > 0 && cook.months.length < 12 && cook.months.includes(month))
    return true;
  return (cook.variantMonths ?? []).some((m) => m.includes(month));
}

const counts = (c: CookRecord) =>
  c.isGlobal && (c.kind === "main" || c.kind === "soup" || c.kind === "simple");

export function countryStamps(cooks: CookRecord[]): CountryStamp[] {
  const map = new Map<string, CountryStamp>();
  for (const c of [...cooks].sort((a, b) => a.cookedOn.localeCompare(b.cookedOn))) {
    if (!counts(c) || !c.origin) continue;
    const s = map.get(c.origin) ?? { code: c.origin, recipeIds: [], firstCookedOn: c.cookedOn };
    if (!s.recipeIds.includes(c.recipeId)) s.recipeIds.push(c.recipeId);
    map.set(c.origin, s);
  }
  return [...map.values()];
}

/** Nombre de recettes de saison différentes cuisinées par saison (`2027-autumn`). */
export function seasonCounts(cooks: CookRecord[]): Map<string, number> {
  const bySeason = new Map<string, Set<string>>();
  for (const c of cooks) {
    if (!counts(c)) continue;
    const month = Number(c.cookedOn.slice(5, 7));
    if (!isSeasonalIn(c, month)) continue;
    const key = seasonOf(c.cookedOn).key;
    bySeason.set(key, (bySeason.get(key) ?? new Set()).add(c.recipeId));
  }
  return new Map([...bySeason].map(([k, ids]) => [k, ids.size]));
}

/** Clés de saison (`2027-autumn`) ayant au moins 6 recettes de saison différentes. */
export function seasonStamps(cooks: CookRecord[]): string[] {
  return [...seasonCounts(cooks)].filter(([, n]) => n >= SEASON_STAMP_THRESHOLD).map(([k]) => k);
}

export interface NewAchievement {
  kind: "country" | "season";
  key: string;
}

/** Tampons gagnés par `cooks` absents de `existing` (clés `country:jp`, `season:2027-autumn`). */
export function newAchievements(cooks: CookRecord[], existing: Set<string>): NewAchievement[] {
  const out: NewAchievement[] = [];
  for (const s of countryStamps(cooks))
    if (!existing.has(`country:${s.code}`)) out.push({ kind: "country", key: s.code });
  for (const k of seasonStamps(cooks)) if (!existing.has(`season:${k}`)) out.push({ kind: "season", key: k });
  return out;
}
