import type { CookKind } from "./passport";
import type { WeekPlan } from "./types";

/** Recettes « cuisinées » d'une semaine (SPEC_PROGRES §4.3) et repas couverts par le batch. TypeScript pur. */

export type PlannedCook = { recipeId: string; kind: CookKind; cookedOn: string };

const DAY_MS = 86_400_000;
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const removed = (plan: Pick<WeekPlan, "removed">, day: number, meal: "lunch" | "dinner") =>
  plan.removed.includes(`${day}-${meal}`);

/** Plats de batch et soupe : inscrits à la fin de session (un plat dont tous les repas sont retirés n'est pas cuisiné). */
export function batchCooks(plan: WeekPlan, sessionDate: string): PlannedCook[] {
  const out: PlannedCook[] = [];
  for (const g of plan.groups) {
    if (g.meals.some((m) => !removed(plan, m.day, m.meal))) {
      out.push({ recipeId: g.id, kind: "main", cookedOn: sessionDate });
    }
  }
  if (plan.soup && plan.soup.days.some((d) => !removed(plan, d, "dinner"))) {
    out.push({ recipeId: plan.soup.id, kind: "soup", cookedOn: sessionDate });
  }
  return out;
}

/** Soirs simples dont le jour est passé (`today` inclus : le repas du soir a eu lieu à la clôture), hors repas retirés. */
export function simpleCooks(plan: WeekPlan, weekStart: string, today: string): PlannedCook[] {
  const out: PlannedCook[] = [];
  for (const s of plan.simples) {
    const date = addDays(weekStart, s.day - 1);
    if (date <= today && !removed(plan, s.day, "dinner")) {
      out.push({ recipeId: s.id, kind: "simple", cookedOn: date });
    }
  }
  return out;
}

/** Y a-t-il quelque chose à préparer le dimanche ? (plat de batch ou soupe au plan) */
export function hasBatch(plan: WeekPlan): boolean {
  return batchCooks(plan, "1970-01-01").length > 0;
}

/** Repas couverts par les plats de batch et la soupe (carte de palier, §3.6) : un par créneau non retiré. */
export function coveredMeals(plan: WeekPlan): number {
  const slots = plan.groups.flatMap((g) => g.meals).filter((m) => !removed(plan, m.day, m.meal)).length;
  const soup = plan.soup ? plan.soup.days.filter((d) => !removed(plan, d, "dinner")).length : 0;
  return slots + soup;
}
