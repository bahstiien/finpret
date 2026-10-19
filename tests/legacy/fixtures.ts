// Passerelle entre l'état du prototype et l'entrée du moteur porté, pour les tests de fidélité.
import { libraryFromSeed } from "@/engine/catalog/library";
import { rawSeed } from "@/engine/catalog/seed-files";
import { validateSeed } from "@/engine/catalog/validate";
import { createEnv, type Env } from "@/engine/env";
import { seededRandom } from "@/engine/random";
import type { BankEntry, ComfortSetting, DietRules, MenuSettings } from "@/engine/types";
import { DEFAULT_MENU_SETTINGS } from "@/engine/types";
import type { LegacyState } from "./legacy";

const { seed } = validateSeed(rawSeed);
export const LIB = libraryFromSeed(seed!);

export function engineEnv(state: LegacyState, seedNumber: number, diet?: DietRules): Env {
  return createEnv({
    lib: LIB,
    pantry: structuredClone(state.pantry ?? {}),
    ratings: structuredClone(state.ratings ?? {}),
    random: seededRandom(seedNumber),
    diet,
  });
}

export function engineSettings(state: LegacyState): MenuSettings {
  const s = state.settings;
  return {
    ...DEFAULT_MENU_SETTINGS,
    pasta: s.pasta,
    light: s.light,
    world: s.world,
    comfort: s.comfort as ComfortSetting,
    bankUse: s.bankUse,
    skip: s.skip.slice(),
    cake: s.gateau ?? true,
  };
}

/** Réserve du prototype ({ id: { boxes, added } }) au format du moteur. */
export function engineBank(state: LegacyState): BankEntry[] {
  return Object.entries(state.bank ?? {}).map(([recipeId, e]) => ({
    recipeId,
    portions: e.boxes,
    frozenAt: new Date(e.added).toISOString(),
  }));
}

/** Historique du moteur : la semaine courante du prototype d'abord, puis ses semaines passées. */
export function engineHistory(state: LegacyState, currentIds: string[]): string[][] {
  return [currentIds, ...(state.history ?? [])];
}

/** Génération du prototype (`generate` sans l'interface). */
export const LEGACY_GENERATE = `(() => {
  const current = week && week.groups ? weekIds() : [];
  const recent = [...new Set([...current, ...history.slice(0,2).flat().filter(id=>ratings[id]!==1)])];
  const T = comfortTarget(); const W = +settings.world;
  let w = compose(recent,T,W) || compose(current,T,W) || compose([],T,W) || compose([],T,0);
  if(!w){ IGNORE_DISLIKE=true; w = compose([],T,0); IGNORE_DISLIKE=false; }
  return w;
})()`;

/** Champs comparés d'une semaine (le prototype ajoute un horodatage `at`). */
export const weekShape = (w: Record<string, unknown> | null) =>
  w && {
    start: w.start,
    groups: w.groups,
    soup: w.soup,
    simples: w.simples,
    bank: w.bank,
    cake: w.cake,
    cm: w.cm,
    cs: w.cs,
    pastaNeed: w.pastaNeed,
    skip: w.skip,
    removed: w.removed,
    doubles: w.doubles,
  };
