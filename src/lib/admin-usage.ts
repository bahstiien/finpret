import { addDays, mondayOf } from "@/lib/dates";

/**
 * Page « Usage et communauté » du back-office : périodes d'analyse et séries des graphiques (pur, sans base).
 */

export const USAGE_PERIODS = {
  "30": { label: "30 jours", unit: "day", buckets: 30 },
  "90": { label: "13 semaines", unit: "week", buckets: 13 },
  "365": { label: "12 mois", unit: "week", buckets: 52 },
} as const;
export type UsagePeriod = keyof typeof USAGE_PERIODS;
export const USAGE_PERIOD_KEYS = Object.keys(USAGE_PERIODS) as UsagePeriod[];

export const parsePeriod = (value: string | undefined): UsagePeriod =>
  USAGE_PERIOD_KEYS.find((k) => k === value) ?? "30";

export type UsageRange = {
  /** Premier jour inclus de la période (lundi si la série est hebdomadaire). */
  since: string;
  /** Premier jour de la période précédente de même longueur (comparaisons). */
  prevSince: string;
  unit: "day" | "week";
  /** Clés des barres du graphique, de la plus ancienne à la plus récente (jours ou lundis). */
  keys: string[];
};

/** Bornes et clés de série d'une période finissant aujourd'hui. */
export function usageRange(period: UsagePeriod, today: string): UsageRange {
  const { unit, buckets } = USAGE_PERIODS[period];
  if (unit === "day") {
    const since = addDays(today, 1 - buckets);
    return {
      since,
      prevSince: addDays(since, -buckets),
      unit,
      keys: Array.from({ length: buckets }, (_, i) => addDays(since, i)),
    };
  }
  const since = addDays(mondayOf(today), -7 * (buckets - 1));
  return {
    since,
    prevSince: addDays(since, -7 * buckets),
    unit,
    keys: Array.from({ length: buckets }, (_, i) => addDays(since, 7 * i)),
  };
}

/** Série continue sur les clés de la période : les jours ou semaines sans ligne valent 0. */
export function fillSeries(rows: { key: string; n: number | string }[], keys: string[]) {
  const byKey = new Map(rows.map((r) => [r.key, Number(r.n)]));
  return keys.map((key) => ({ key, n: byKey.get(key) ?? 0 }));
}

/** Part en pourcentage arrondi (« — » si le total est nul). */
export const share = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)} %` : "—");

export const KIND_LABEL: Record<string, string> = {
  main: "Plat de batch",
  soup: "Soupe du soir",
  simple: "Soir simple",
};

export const PROTEIN_LABEL: Record<string, string> = {
  volaille: "Volaille",
  boeuf: "Bœuf",
  porc: "Porc",
  poisson: "Poisson",
  veg: "Végétarien",
};

export const STREAK_LABEL: Record<string, string> = {
  done: "Fin prête",
  paused: "En pause",
  neutral: "Neutre",
  missed: "Manquée",
};

/** Événements suivis dans le bloc « Engagement », avec leur libellé. */
export const ENGAGEMENT_EVENTS = [
  ["week_generated", "Menus générés"],
  ["menu_swap", "Plats remplacés"],
  ["purchase_recorded", "Achats saisis"],
  ["shopping_issue_reported", "Problèmes de courses signalés"],
  ["adaptation_committed", "Menus adaptés aux courses"],
  ["stamp_earned", "Tampons du passeport"],
  ["streak_milestone", "Paliers de série atteints"],
  ["share_card_created", "Cartes partagées"],
] as const;

/** Les `n` premiers éléments selon un score (décroissant, puis par nom) ; les scores nuls sont écartés. */
export function topBy<T extends { name: string }>(
  items: readonly T[],
  score: (item: T) => number,
  n = 8,
): T[] {
  return items
    .filter((i) => score(i) > 0)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, "fr"))
    .slice(0, n);
}
