import type { Meal, Slot } from "./types";

/** Structure de la semaine (§7.3, point 1) : port de buildSlots, gMax, assignGroups. */

const MEAL_ORDER: Record<Meal, number> = { lunch: 0, dinner: 1 };

export const sortMeals = (a: Slot, b: Slot) => a.day - b.day || MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal];

export type WeekSlots = {
  groups: Slot[][];
  soupDays: number[];
  simpleDays: number[];
  bankSlots: Slot[];
};

/**
 * @param light nombre de soirs légers (mardi, jeudi, mercredi, vendredi, lundi) ; les 2 premiers en soupe
 * @param bankCount repas tirés de la réserve (vendredi midi, jeudi midi, vendredi soir…)
 * @param skip créneaux décochés (« 3-lunch »)
 */
export function buildSlots(light: number, bankCount = 0, skip: readonly string[] = []): WeekSlots {
  const sk = (d: number, m: Meal) => skip.includes(`${d}-${m}`);
  const lightDays = [2, 4, 3, 5, 1].filter((d) => !sk(d, "dinner")).slice(0, light);
  const soupDays = light >= 2 && lightDays.length >= 2 ? lightDays.slice(0, 2).sort() : [];
  const simpleDays = lightDays.filter((d) => !soupDays.includes(d)).sort();
  const cand: [number, Meal][] = (
    [
      [5, "lunch"],
      [4, "lunch"],
      [5, "dinner"],
      [4, "dinner"],
      [3, "lunch"],
      [3, "dinner"],
      [2, "lunch"],
      [2, "dinner"],
      [1, "dinner"],
      [1, "lunch"],
    ] as [number, Meal][]
  ).filter(([d, m]) => !(m === "dinner" && lightDays.includes(d)) && !sk(d, m));
  const bankSlots = cand.slice(0, bankCount).map(([day, meal]) => ({ day, meal }));
  const isBank = (d: number, m: Meal) => bankSlots.some((s) => s.day === d && s.meal === m);
  const mainD = [1, 2, 3, 4, 5].filter(
    (d) => !lightDays.includes(d) && !isBank(d, "dinner") && !sk(d, "dinner"),
  );
  const freeL = new Set([1, 2, 3, 4, 5].filter((d) => !isBank(d, "lunch") && !sk(d, "lunch")));
  const groups: Slot[][] = [];
  // Chaque plat couvre un dîner et le déjeuner du lendemain.
  for (const d of mainD) {
    const nxt = d < 5 ? d + 1 : 1;
    if (freeL.has(nxt)) {
      groups.push([
        { day: d, meal: "dinner" },
        { day: nxt, meal: "lunch" },
      ]);
      freeL.delete(nxt);
    } else groups.push([{ day: d, meal: "dinner" }]);
  }
  const rest = [...freeL].sort();
  for (const g of groups) {
    if (g.length === 1 && rest.length) {
      const i = rest.findIndex((d) => d !== g[0]!.day);
      if (i >= 0) g.push({ day: rest.splice(i, 1)[0]!, meal: "lunch" });
    }
  }
  while (rest.length >= 2) {
    groups.push([
      { day: rest.shift()!, meal: "lunch" },
      { day: rest.shift()!, meal: "lunch" },
    ]);
  }
  if (rest.length) {
    const d = rest.shift()!;
    // Jamais le même plat midi et soir le même jour, sauf s'il n'y a pas d'autre solution.
    const tgt =
      [...groups].reverse().find((g) => !g.some((m) => m.day === d)) ??
      groups[groups.length - 1] ??
      groups[0];
    if (tgt) tgt.push({ day: d, meal: "lunch" });
    else groups.push([{ day: d, meal: "lunch" }]);
  }
  groups.forEach((g) => g.sort(sortMeals));
  return { groups, soupDays, simpleDays, bankSlots };
}

/** Dernier jour servi par un plat. */
export const gMax = (meals: readonly Slot[]) => Math.max(...meals.map((m) => m.day));

/**
 * Répartit les plats sur les groupes : les non congelables d'abord sur les groupes les plus proches,
 * dans la limite de leur conservation au frigo. Renvoie les identifiants par groupe, ou null.
 */
export function assignGroups(
  list: readonly { id: string; freeze: boolean; fridge: number }[],
  groups: readonly Slot[][],
): string[] | null {
  const order = groups.map((_, i) => i).sort((a, b) => gMax(groups[a]!) - gMax(groups[b]!));
  const nf = list.filter((r) => !r.freeze).sort((a, b) => a.fridge - b.fridge);
  const fz = list.filter((r) => r.freeze).sort((a, b) => a.fridge - b.fridge);
  const res: string[] = new Array(groups.length);
  let k = 0;
  for (const r of nf) {
    const gi = order[k++]!;
    if (gMax(groups[gi]!) > r.fridge) return null;
    res[gi] = r.id;
  }
  for (const r of fz) res[order[k++]!] = r.id;
  return res;
}
