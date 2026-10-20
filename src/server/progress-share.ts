import "server-only";
import { coveredMeals } from "@/engine/cooks";
import type { WeekPlan } from "@/engine/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Repas préparés pendant les `milestone` dernières semaines fin prêtes (SPEC_PROGRES §3.6, question ouverte 2 :
 * un repas par créneau couvert par les plats de batch et la soupe).
 */
export async function milestoneMeals(householdId: string, milestone: number): Promise<number> {
  const supabase = await createClient();
  const { data: done } = await supabase
    .from("streak_weeks")
    .select("week_start")
    .eq("household_id", householdId)
    .eq("outcome", "done")
    .order("week_start", { ascending: false })
    .limit(milestone);
  const starts = (done ?? []).map((w) => w.week_start);
  if (starts.length === 0) return 0;
  const { data: weeks } = await supabase
    .from("weeks")
    .select("plan")
    .eq("household_id", householdId)
    .in("start_date", starts);
  return (weeks ?? []).reduce((sum, w) => sum + coveredMeals(w.plan as unknown as WeekPlan), 0);
}
