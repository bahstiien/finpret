import "server-only";
import type { PlannedCook } from "@/engine/cooks";
import type { CookRecord } from "@/engine/passport";
import type { WeekPlan } from "@/engine/types";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackEvent } from "@/server/events";
import type { ProgressStore } from "@/server/progress";

/** Implémentation de `ProgressStore` avec la clé de service (aucune écriture client sur ces tables, SPEC_PROGRES §6.2). */
export function createProgressStore(db = createAdminClient()): ProgressStore {
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  return {
    async timezone(householdId) {
      const { data, error } = await db.from("households").select("timezone").eq("id", householdId).single();
      fail(error);
      return data?.timezone ?? "Europe/Paris";
    },

    async week(weekId) {
      const { data, error } = await db
        .from("weeks")
        .select("id, household_id, start_date, plan")
        .eq("id", weekId)
        .maybeSingle();
      fail(error);
      return data
        ? {
            id: data.id,
            householdId: data.household_id,
            startDate: data.start_date,
            plan: data.plan as unknown as WeekPlan,
          }
        : null;
    },

    async weeksBetween(householdId, from, to) {
      const { data, error } = await db
        .from("weeks")
        .select("id, start_date, plan")
        .eq("household_id", householdId)
        .gte("start_date", from)
        .lte("start_date", to)
        .order("start_date");
      fail(error);
      return (data ?? []).map((w) => ({
        id: w.id,
        startDate: w.start_date,
        plan: w.plan as unknown as WeekPlan,
      }));
    },

    async setDoneAt(weekId, at) {
      // La première valeur est conservée : on n'écrit que si `done_at` est vide, puis on relit.
      const { error } = await db
        .from("sessions")
        .update({ done_at: at.toISOString() })
        .eq("week_id", weekId)
        .is("done_at", null);
      fail(error);
      const { data, error: readError } = await db
        .from("sessions")
        .select("done_at")
        .eq("week_id", weekId)
        .maybeSingle();
      fail(readError);
      return data?.done_at ? new Date(data.done_at) : at;
    },

    async upsertCooks(householdId, weekId, cooks: PlannedCook[], backfilled) {
      if (cooks.length === 0) return;
      const { error } = await db.from("recipe_cooks").upsert(
        cooks.map((c) => ({
          household_id: householdId,
          recipe_id: c.recipeId,
          week_id: weekId,
          kind: c.kind,
          cooked_on: c.cookedOn,
          backfilled,
        })),
        { onConflict: "household_id,recipe_id,week_id", ignoreDuplicates: true },
      );
      fail(error);
    },

    async cookRecords(householdId) {
      const { data, error } = await db
        .from("recipe_cooks")
        .select("recipe_id, kind, cooked_on, recipes(origin, months, household_id, sv:data->sv)")
        .eq("household_id", householdId);
      fail(error);
      return (data ?? []).flatMap((c): CookRecord[] => {
        const r = c.recipes as unknown as {
          origin: string | null;
          months: number[] | null;
          household_id: string | null;
          sv: { m: number[] }[] | null;
        } | null;
        if (!r) return [];
        return [
          {
            recipeId: c.recipe_id,
            cookedOn: c.cooked_on,
            kind: c.kind,
            origin: r.origin,
            isGlobal: r.household_id === null,
            ...(r.months ? { months: r.months } : {}),
            ...(r.sv ? { variantMonths: r.sv.map((v) => v.m) } : {}),
          },
        ];
      });
    },

    async achievements(householdId) {
      const { data, error } = await db
        .from("achievements")
        .select("kind, key")
        .eq("household_id", householdId);
      fail(error);
      return data ?? [];
    },

    async insertAchievements(householdId, rows) {
      const now = new Date().toISOString();
      const { error } = await db.from("achievements").upsert(
        rows.map((r) => ({
          household_id: householdId,
          kind: r.kind,
          key: r.key,
          seen_at: r.seen ? now : null,
        })),
        { onConflict: "household_id,kind,key", ignoreDuplicates: true },
      );
      fail(error);
    },

    async streakWeeks(householdId) {
      const { data, error } = await db
        .from("streak_weeks")
        .select("week_start, outcome, source, closed_at")
        .eq("household_id", householdId)
        .order("week_start");
      fail(error);
      return (data ?? []).map((w) => ({
        weekStart: w.week_start,
        outcome: w.outcome,
        ...(w.source ? { source: w.source } : {}),
        closedAt: w.closed_at,
      }));
    },

    async putStreakWeek(householdId, row, { overwrite }) {
      const values = {
        household_id: householdId,
        week_start: row.weekStart,
        outcome: row.outcome,
        source: row.source ?? null,
        closed_at: row.closedAt,
      };
      const { error } = overwrite
        ? await db.from("streak_weeks").upsert(values, { onConflict: "household_id,week_start" })
        : await db
            .from("streak_weeks")
            .upsert(values, { onConflict: "household_id,week_start", ignoreDuplicates: true });
      fail(error);
    },

    async removeStreakWeek(householdId, weekStart) {
      const { error } = await db
        .from("streak_weeks")
        .delete()
        .eq("household_id", householdId)
        .eq("week_start", weekStart);
      fail(error);
    },

    async householdsToClose(sinceWeek) {
      const [done, recent] = await Promise.all([
        db.from("streak_weeks").select("household_id").eq("outcome", "done"),
        db.from("weeks").select("household_id").gte("start_date", sinceWeek),
      ]);
      fail(done.error);
      fail(recent.error);
      return [...new Set([...(done.data ?? []), ...(recent.data ?? [])].map((r) => r.household_id))];
    },

    async track(name, householdId, props) {
      await trackEvent(name, { householdId, props: props as Record<string, Json> });
    },
  };
}
