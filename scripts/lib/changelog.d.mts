export type Change = { pr: number | null; title: string };
export type Deploy = { sha: string; at: string; run: number | null };
export const LOG_FORMAT: string;
export function parseLog(out: string): Change[];
/** `changes` vaut null quand l'historique entre deux déploiements est introuvable. */
export function buildChangelog(
  deploys: Deploy[],
  logBetween: (from: string, to: string) => Change[] | null,
): (Deploy & { changes: Change[] | null })[];
