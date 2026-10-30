import "server-only";
import { cache } from "react";
import type { Member, PresenceRule } from "@/engine/portions";
import { householdPortions } from "@/engine/portions";
import type { BankEntry, Pantry, Ratings, WeekPlan } from "@/engine/types";
import { type HouseholdSettings, parseSettings } from "@/lib/settings";
import type { Db } from "@/server/db";
import { withSession } from "@/server/session";

export type WeekRow = {
  id: string;
  start_date: string;
  status: "draft" | "active" | "done";
  plan: WeekPlan;
  pasta_need: number | null;
  pantry_done: boolean;
  /** Version de la ligne : une modification concurrente du plan est détectée à l'écriture. */
  updated_at: string;
};

export type HouseholdContext = {
  id: string;
  name: string;
  timezone: string;
  alternatingFrom: string | null;
  onboardedAt: string | null;
  settings: HouseholdSettings;
  members: (Member & { userId?: string | null })[];
  presence: PresenceRule[];
  pantry: Pantry;
  bank: BankEntry[];
  ratings: Ratings;
  /** Semaines enregistrées, la plus récente d'abord. */
  weeks: WeekRow[];
};

/** Tout ce dont le moteur a besoin pour un foyer (réglages, membres, stock, avis, semaines). */
/** `client` : transaction déjà ouverte (tâches planifiées en `withAdmin`) ; sinon, transaction de la session. */
export const loadHouseholdContext = cache(
  async (householdId: string, client?: Db): Promise<HouseholdContext> =>
    client ? load(client, householdId) : withSession((db) => load(db, householdId)),
);

async function load(db: Db, householdId: string): Promise<HouseholdContext> {
  const household = await db
    .selectFrom("households")
    .select(["id", "name", "timezone", "alternating_from", "onboarded_at"])
    .where("id", "=", householdId)
    .executeTakeFirstOrThrow();
  const settings = await db
    .selectFrom("household_settings")
    .select(["diet", "menu", "session", "shopping", "equipment", "canteen"])
    .where("household_id", "=", householdId)
    .executeTakeFirst();
  const memberRows = await db
    .selectFrom("members")
    .select(["id", "name", "kind", "birthdate", "portion_override", "archived", "user_id"])
    .where("household_id", "=", householdId)
    .orderBy("name")
    .execute();
  const pantry = await db
    .selectFrom("pantry")
    .select(["ingredient_key", "qty"])
    .where("household_id", "=", householdId)
    .execute();
  const freezer = await db
    .selectFrom("freezer")
    .select(["recipe_id", "portions", "frozen_at"])
    .where("household_id", "=", householdId)
    .orderBy("frozen_at")
    .execute();
  const ratings = await db
    .selectFrom("ratings")
    .select(["recipe_id", "value"])
    .where("household_id", "=", householdId)
    .execute();
  const weeks = await db
    .selectFrom("weeks")
    .select(["id", "start_date", "status", "plan", "pasta_need", "pantry_done", "updated_at"])
    .where("household_id", "=", householdId)
    .orderBy("start_date", "desc")
    .limit(8)
    .execute();
  const presence = memberRows.length
    ? await db
        .selectFrom("presence_rules")
        .select(["member_id", "weekday", "meal", "present", "week_parity"])
        .where(
          "member_id",
          "in",
          memberRows.map((m) => m.id),
        )
        .execute()
    : [];

  return {
    id: household.id,
    name: household.name,
    timezone: household.timezone,
    alternatingFrom: household.alternating_from,
    onboardedAt: household.onboarded_at,
    settings: parseSettings(settings ?? null),
    members: memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      birthdate: m.birthdate,
      portionOverride: m.portion_override,
      archived: m.archived,
      userId: m.user_id,
    })),
    presence: presence.map((p) => ({
      memberId: p.member_id,
      weekday: p.weekday,
      meal: p.meal,
      present: p.present,
      weekParity: p.week_parity,
    })),
    pantry: Object.fromEntries(pantry.map((p) => [p.ingredient_key, p.qty === null ? null : Number(p.qty)])),
    bank: freezer.map((f) => ({
      recipeId: f.recipe_id,
      portions: f.portions,
      frozenAt: f.frozen_at,
    })),
    ratings: Object.fromEntries(ratings.map((r) => [r.recipe_id, r.value as 1 | -1])),
    weeks: weeks as WeekRow[],
  };
}

export function portionModelFor(ctx: HouseholdContext, weekStart: string) {
  return householdPortions({
    members: ctx.members,
    presence: ctx.presence,
    weekStart,
    alternatingFrom: ctx.alternatingFrom,
  });
}
