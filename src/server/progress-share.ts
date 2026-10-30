import "server-only";
import { coveredMeals } from "@/engine/cooks";
import type { WeekPlan } from "@/engine/types";
import { withSession } from "@/server/session";

/**
 * Repas préparés pendant les `milestone` dernières semaines fin prêtes (SPEC_PROGRES §3.6, question ouverte 2 :
 * un repas par créneau couvert par les plats de batch et la soupe).
 */
export async function milestoneMeals(householdId: string, milestone: number): Promise<number> {
  const weeks = await withSession(async (db) => {
    const done = await db
      .selectFrom("streak_weeks")
      .select("week_start")
      .where("household_id", "=", householdId)
      .where("outcome", "=", "done")
      .orderBy("week_start", "desc")
      .limit(milestone)
      .execute();
    const starts = done.map((w) => w.week_start);
    if (starts.length === 0) return [];
    return db
      .selectFrom("weeks")
      .select("plan")
      .where("household_id", "=", householdId)
      .where("start_date", "in", starts)
      .execute();
  });
  return weeks.reduce((sum, w) => sum + coveredMeals(w.plan as unknown as WeekPlan), 0);
}
