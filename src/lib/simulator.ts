/** Simulateur de la landing (SPEC_JANVIER §8 bis A) : familles × part qui s'abonne × 8 €, arrondi à la dizaine. */
export const SIM_FAMILIES = { min: 50, max: 800, default: 200 } as const;
export const SIM_SHARE = { min: 5, max: 30, default: 15 } as const;
export const SIM_EURO_PER_FAMILY = 8;

export function estimateAnnualAmount(families: number, sharePercent: number): number {
  const f = Math.min(SIM_FAMILIES.max, Math.max(SIM_FAMILIES.min, Math.round(families)));
  const s = Math.min(SIM_SHARE.max, Math.max(SIM_SHARE.min, sharePercent));
  return Math.round((f * (s / 100) * SIM_EURO_PER_FAMILY) / 10) * 10;
}
