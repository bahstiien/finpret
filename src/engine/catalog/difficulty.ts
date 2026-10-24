/**
 * Niveau de difficulté d'une recette : 1 (très facile) à 4 (technique).
 * Barème indicatif, utilisé pour renseigner le seed et les recettes importées :
 *  1 = peu de gestes, rien à surveiller ; 2 = recette courante ; 3 = plusieurs étapes à mener de front ;
 *  4 = technique ou longue préparation (pâte levée, plusieurs cuissons simultanées).
 */
export const DIFFICULTIES = [1, 2, 3, 4] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

type Estimable = {
  prepMin?: number;
  blocks?: { mode: string; active: number }[];
  ing?: Record<string, number>;
  steps?: string[];
  /** Durée d'un goûter, en texte (« 45 min dont 30 min de repos », « 3 h dont 2 h de pousse »). */
  tm?: string;
};

const level = (score: number, limits: [number, number, number]): Difficulty =>
  score <= limits[0] ? 1 : score <= limits[1] ? 2 : score <= limits[2] ? 3 : 4;

/** Durée active d'un goûter : le texte avant « dont » / « et » (le repos ou la pousse ne comptent pas). */
function cakeMinutes(tm: string): number {
  const head = tm.split(/ dont | et /)[0]!;
  const hours = /(\d+)\s*h/.exec(head);
  const minutes = /(\d+)\s*min/.exec(head);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

export function estimateDifficulty(r: Estimable): Difficulty {
  if (r.blocks) {
    // Temps de travail + gestes menés de front (étapes et modes de cuisson différents).
    const modes = new Set(r.blocks.filter((b) => b.mode !== "plan").map((b) => b.mode)).size;
    const active = (r.prepMin ?? 0) + r.blocks.reduce((s, b) => s + b.active, 0);
    return level(active + 3 * Math.max(0, r.blocks.length - 1) + 5 * Math.max(0, modes - 1), [14, 22, 32]);
  }
  if (r.tm !== undefined) {
    if (/pousse/.test(r.tm)) return 4;
    return level(cakeMinutes(r.tm), [30, 50, 70]);
  }
  return level(Object.keys(r.ing ?? {}).length + (r.steps?.length ?? 0), [7, 10, 13]);
}
