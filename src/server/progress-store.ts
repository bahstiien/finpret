import "server-only";
import { sql } from "kysely";
import type { PlannedCook } from "@/engine/cooks";
import type { CookRecord } from "@/engine/passport";
import type { WeekPlan } from "@/engine/types";
import { type Db, withAdmin } from "@/server/db";
import type { Json } from "@/server/db.types";
import { trackEvent } from "@/server/events";
import type { ProgressStore } from "@/server/progress";

/**
 * Implémentation de `ProgressStore` avec la clé de service (aucune écriture client sur ces tables, SPEC_PROGRES §6.2).
 * `client` : transaction déjà ouverte ; sinon, chaque appel ouvre la sienne.
 */
export function createProgressStore(client?: Db): ProgressStore {
  const run = <T>(fn: (db: Db) => Promise<T>): Promise<T> => (client ? fn(client) : withAdmin(fn));

  return {
    async timezone(householdId) {
      const data = await run((db) =>
        db
          .selectFrom("households")
          .select("timezone")
          .where("id", "=", householdId)
          .executeTakeFirstOrThrow(),
      );
      return data.timezone ?? "Europe/Paris";
    },

    async week(weekId) {
      const data = await run((db) =>
        db
          .selectFrom("weeks")
          .select(["id", "household_id", "start_date", "plan"])
          .where("id", "=", weekId)
          .executeTakeFirst(),
      );
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
      const data = await run((db) =>
        db
          .selectFrom("weeks")
          .select(["id", "start_date", "plan"])
          .where("household_id", "=", householdId)
          .where("start_date", ">=", from)
          .where("start_date", "<=", to)
          .orderBy("start_date")
          .execute(),
      );
      return data.map((w) => ({
        id: w.id,
        startDate: w.start_date,
        plan: w.plan as unknown as WeekPlan,
      }));
    },

    async setDoneAt(weekId, at) {
      // La première valeur est conservée : on n'écrit que si `done_at` est vide, puis on relit.
      const data = await run(async (db) => {
        await db
          .updateTable("sessions")
          .set({ done_at: at.toISOString() })
          .where("week_id", "=", weekId)
          .where("done_at", "is", null)
          .execute();
        return db.selectFrom("sessions").select("done_at").where("week_id", "=", weekId).executeTakeFirst();
      });
      return data?.done_at ? new Date(data.done_at) : at;
    },

    async upsertCooks(householdId, weekId, cooks: PlannedCook[], backfilled) {
      if (cooks.length === 0) return;
      await run((db) =>
        db
          .insertInto("recipe_cooks")
          .values(
            cooks.map((c) => ({
              household_id: householdId,
              recipe_id: c.recipeId,
              week_id: weekId,
              kind: c.kind,
              cooked_on: c.cookedOn,
              backfilled,
            })),
          )
          .onConflict((oc) => oc.columns(["household_id", "recipe_id", "week_id"]).doNothing())
          .execute(),
      );
    },

    async cookRecords(householdId) {
      const data = await run((db) =>
        db
          .selectFrom("recipe_cooks")
          .innerJoin("recipes", "recipes.id", "recipe_cooks.recipe_id")
          .select([
            "recipe_cooks.recipe_id",
            "recipe_cooks.kind",
            "recipe_cooks.cooked_on",
            "recipes.origin",
            "recipes.months",
            "recipes.household_id",
            sql<{ m: number[] }[] | null>`recipes.data->'sv'`.as("sv"),
          ])
          .where("recipe_cooks.household_id", "=", householdId)
          .execute(),
      );
      return data.map((c): CookRecord => ({
        recipeId: c.recipe_id,
        cookedOn: c.cooked_on,
        kind: c.kind,
        origin: c.origin,
        isGlobal: c.household_id === null,
        ...(c.months ? { months: c.months } : {}),
        ...(c.sv ? { variantMonths: c.sv.map((v) => v.m) } : {}),
      }));
    },

    async achievements(householdId) {
      return run((db) =>
        db
          .selectFrom("achievements")
          .select(["kind", "key"])
          .where("household_id", "=", householdId)
          .execute(),
      );
    },

    async insertAchievements(householdId, rows) {
      if (rows.length === 0) return;
      const now = new Date().toISOString();
      await run((db) =>
        db
          .insertInto("achievements")
          .values(
            rows.map((r) => ({
              household_id: householdId,
              kind: r.kind,
              key: r.key,
              seen_at: r.seen ? now : null,
            })),
          )
          .onConflict((oc) => oc.columns(["household_id", "kind", "key"]).doNothing())
          .execute(),
      );
    },

    async streakWeeks(householdId) {
      const data = await run((db) =>
        db
          .selectFrom("streak_weeks")
          .select(["week_start", "outcome", "source", "closed_at"])
          .where("household_id", "=", householdId)
          .orderBy("week_start")
          .execute(),
      );
      return data.map((w) => ({
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
      await run((db) =>
        db
          .insertInto("streak_weeks")
          .values(values)
          .onConflict((oc) =>
            overwrite
              ? oc.columns(["household_id", "week_start"]).doUpdateSet((eb) => ({
                  outcome: eb.ref("excluded.outcome"),
                  source: eb.ref("excluded.source"),
                  closed_at: eb.ref("excluded.closed_at"),
                }))
              : oc.columns(["household_id", "week_start"]).doNothing(),
          )
          .execute(),
      );
    },

    async removeStreakWeek(householdId, weekStart) {
      await run((db) =>
        db
          .deleteFrom("streak_weeks")
          .where("household_id", "=", householdId)
          .where("week_start", "=", weekStart)
          .execute(),
      );
    },

    async householdsToClose(sinceWeek) {
      const [done, recent] = await run((db) =>
        Promise.all([
          db.selectFrom("streak_weeks").select("household_id").where("outcome", "=", "done").execute(),
          db.selectFrom("weeks").select("household_id").where("start_date", ">=", sinceWeek).execute(),
        ]),
      );
      return [...new Set([...done, ...recent].map((r) => r.household_id))];
    },

    async track(name, householdId, props) {
      await trackEvent(name, { householdId, props: props as Record<string, Json> });
    },
  };
}
