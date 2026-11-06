import { countryLabel, type Season, SEASON_STAMP_THRESHOLD, seasonOf } from "./passport";

/** Données d'affichage du passeport (SPEC_PROGRES §4.4) : calcul pur à partir du catalogue et des recettes cuisinées. */

export type CatalogRecipe = { id: string; name: string; origin: string | null; kind: string };
export type CookedRecipe = { recipeId: string; cookedOn: string };

export type CountryEntry = {
  code: string;
  label: string;
  total: number;
  earned: boolean;
  firstCookedOn: string | null;
  cooked: { id: string; name: string; on: string }[];
  remaining: { id: string; name: string }[];
};

const BATCH_KINDS = new Set(["main", "soup", "simple"]);

/** Un tampon par pays du catalogue : les obtenus d'abord (par date), puis les vides par ordre alphabétique. */
export function buildCountries(catalog: CatalogRecipe[], cooks: CookedRecipe[]): CountryEntry[] {
  const byCountry = new Map<string, CatalogRecipe[]>();
  for (const r of catalog) {
    if (!r.origin || !BATCH_KINDS.has(r.kind)) continue;
    byCountry.set(r.origin, [...(byCountry.get(r.origin) ?? []), r]);
  }
  const first = new Map<string, string>();
  for (const c of cooks) {
    const on = first.get(c.recipeId);
    if (!on || c.cookedOn < on) first.set(c.recipeId, c.cookedOn);
  }
  const entries = [...byCountry].map(([code, recipes]): CountryEntry => {
    const cooked = recipes
      .filter((r) => first.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, on: first.get(r.id)! }))
      .sort((a, b) => a.on.localeCompare(b.on) || a.name.localeCompare(b.name, "fr"));
    return {
      code,
      label: countryLabel(code),
      total: recipes.length,
      earned: cooked.length > 0,
      firstCookedOn: cooked[0]?.on ?? null,
      cooked,
      remaining: recipes
        .filter((r) => !first.has(r.id))
        .map((r) => ({ id: r.id, name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    };
  });
  return entries.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned)
      return (
        (a.firstCookedOn ?? "").localeCompare(b.firstCookedOn ?? "") || a.label.localeCompare(b.label, "fr")
      );
    return a.label.localeCompare(b.label, "fr");
  });
}

export type SeasonEntry = { key: string; season: Season; year: number; count: number; earned: boolean };

const SEASON_ORDER: Season[] = ["winter", "spring", "summer", "autumn"];

/** Saisons de l'année en cours et de l'année précédente, dans l'ordre. `earnedKeys` : tampons déjà inscrits. */
export function buildSeasons(
  today: string,
  counts: Map<string, number>,
  earnedKeys: Set<string>,
): SeasonEntry[] {
  const { year } = seasonOf(today);
  const out: SeasonEntry[] = [];
  for (const y of [year - 1, year]) {
    for (const season of SEASON_ORDER) {
      const key = `${y}-${season}`;
      const count = counts.get(key) ?? 0;
      out.push({
        key,
        season,
        year: y,
        count,
        earned: earnedKeys.has(key) || count >= SEASON_STAMP_THRESHOLD,
      });
    }
  }
  return out;
}

export type FriseState = "done" | "paused" | "neutral" | "missed" | "todo" | "none";
export type FriseWeek = { weekStart: string; state: FriseState; current: boolean };

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Frise des `n` dernières semaines, la plus ancienne d'abord, la semaine en cours en dernier. Une semaine sans
 * ligne (avant le début de la série) est `none` ; une pause planifiée à venir n'y figure pas.
 */
export function buildFrise(
  history: { weekStart: string; outcome: "done" | "paused" | "neutral" | "missed" }[],
  currentMonday: string,
  currentState: "todo" | "done" | "paused" | "neutral",
  n = 12,
): FriseWeek[] {
  const byStart = new Map(history.map((h) => [h.weekStart, h.outcome] as const));
  return Array.from({ length: n }, (_, i) => {
    const weekStart = addDays(currentMonday, -7 * (n - 1 - i));
    const current = weekStart === currentMonday;
    return { weekStart, current, state: current ? currentState : (byStart.get(weekStart) ?? "none") };
  });
}

/** Premier jour (ISO) du trimestre civil qui suit celui de `iso`. */
export function nextQuarterStart(iso: string): string {
  const [y = 0, m = 1] = iso.split("-").map(Number);
  const q = Math.floor((m - 1) / 3);
  return q === 3 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 4).padStart(2, "0")}-01`;
}

export type PauseToken = { weekStart: string; upcoming: boolean };

/**
 * Jetons de pause pris sur le trimestre de la semaine `activeWeek` (passés, en cours ou posés à l'avance),
 * du plus ancien au plus récent. `upcoming` : semaine postérieure à la semaine active (pause posée, annulable).
 */
export function quarterTokens(
  history: { weekStart: string; outcome: string }[],
  activeWeek: string,
): PauseToken[] {
  const quarter = (iso: string) => iso.slice(0, 4) + Math.floor((Number(iso.slice(5, 7)) - 1) / 3);
  const q = quarter(activeWeek);
  return history
    .filter((w) => w.outcome === "paused" && quarter(w.weekStart) === q)
    .map((w) => ({ weekStart: w.weekStart, upcoming: w.weekStart > activeWeek }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** Badges de progression du passeport : un par palier de pays tamponnés, le dernier = tout le passeport. */
export const BADGE_STEPS = [
  { at: 3, key: "curious" },
  { at: 6, key: "traveler" },
  { at: 12, key: "globetrotter" },
  { at: 18, key: "explorer" },
] as const;

export type BadgeKey = (typeof BADGE_STEPS)[number]["key"] | "world";
export type Badge = { key: BadgeKey; at: number; state: "earned" | "current" | "locked"; progress: number };

/** Échelle des badges pour `earned` pays tamponnés sur `total` : obtenus, celui en cours (part remplie), à venir. */
export function badgeLadder(earned: number, total: number): Badge[] {
  const steps: { at: number; key: BadgeKey }[] = [
    ...BADGE_STEPS.filter((s) => s.at < total),
    ...(total > 0 ? [{ at: total, key: "world" as const }] : []),
  ];
  let currentFound = false;
  return steps.map((s) => {
    if (earned >= s.at) return { ...s, state: "earned", progress: 1 };
    if (!currentFound) {
      currentFound = true;
      return { ...s, state: "current", progress: earned / s.at };
    }
    return { ...s, state: "locked", progress: 0 };
  });
}

/** Badge franchi en passant de `before` à `after` pays (le plus haut s'il y en a plusieurs), sinon null. */
export function badgeCrossed(before: number, after: number, total: number): Badge | null {
  const crossed = badgeLadder(after, total).filter((b) => b.at > before && b.at <= after);
  return crossed[crossed.length - 1] ?? null;
}

/** Dernier jour (ISO) d'une saison (`2026-autumn` → 2026-11-30 ; l'hiver 2027 → 2027-02-28/29). */
export function seasonEnd(key: string): string {
  const [ys, season] = key.split("-");
  const y = Number(ys);
  if (season === "winter") return addDays(`${y}-03-01`, -1);
  const end = { spring: "05-31", summer: "08-31", autumn: "11-30" }[season as "spring" | "summer" | "autumn"];
  return `${y}-${end}`;
}

/** Premier jour (ISO) d'une saison (`2027-winter` → 2026-12-01). */
export function seasonStart(key: string): string {
  const [ys, season] = key.split("-");
  const y = Number(ys);
  if (season === "winter") return `${y - 1}-12-01`;
  const start = { spring: "03-01", summer: "06-01", autumn: "09-01" }[season as "spring" | "summer" | "autumn"];
  return `${y}-${start}`;
}

export type SeasonCard = SeasonEntry & { state: "earned" | "current" | "missed" | "upcoming" };

/**
 * Saisons du passeport autour d'aujourd'hui : la saison en cours, les deux précédentes et la suivante.
 * Une saison passée sans ses 6 recettes est « manquée » (jamais rouge, voir la planche d'états).
 */
export function seasonCards(today: string, counts: Map<string, number>, earnedKeys: Set<string>) {
  const { key } = seasonOf(today);
  const prev = (k: string) => seasonOf(addDays(seasonStart(k), -1)).key;
  const next = seasonOf(addDays(seasonEnd(key), 1)).key;
  const card = (k: string, state: SeasonCard["state"]): SeasonCard => {
    const [y, season] = k.split("-");
    const count = counts.get(k) ?? 0;
    const earned = earnedKeys.has(k) || count >= SEASON_STAMP_THRESHOLD;
    return {
      key: k,
      season: season as Season,
      year: Number(y),
      count,
      earned,
      state: earned ? "earned" : state,
    };
  };
  const p1 = prev(key);
  const p2 = prev(p1);
  return {
    current: card(key, "current"),
    others: [card(p2, "missed"), card(p1, "missed"), card(next, "upcoming")],
  };
}
