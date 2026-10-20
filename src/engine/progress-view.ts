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
