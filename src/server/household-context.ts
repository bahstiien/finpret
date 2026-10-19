import "server-only";
import { cache } from "react";
import type { Member, PresenceRule } from "@/engine/portions";
import { householdPortions } from "@/engine/portions";
import type { BankEntry, Pantry, Ratings, WeekPlan } from "@/engine/types";
import { type HouseholdSettings, parseSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export type WeekRow = {
  id: string;
  start_date: string;
  status: "draft" | "active" | "done";
  plan: WeekPlan;
  pasta_need: number | null;
  pantry_done: boolean;
};

export type HouseholdContext = {
  id: string;
  name: string;
  timezone: string;
  alternatingFrom: string | null;
  onboardedAt: string | null;
  settings: HouseholdSettings;
  members: Member[];
  presence: PresenceRule[];
  pantry: Pantry;
  bank: BankEntry[];
  ratings: Ratings;
  /** Semaines enregistrées, la plus récente d'abord. */
  weeks: WeekRow[];
};

/** Tout ce dont le moteur a besoin pour un foyer (réglages, membres, stock, avis, semaines). */
export const loadHouseholdContext = cache(async (householdId: string): Promise<HouseholdContext> => {
  const supabase = await createClient();
  const [household, settings, members, pantry, freezer, ratings, weeks] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, timezone, alternating_from, onboarded_at")
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_settings")
      .select("diet, menu, session, shopping, equipment")
      .eq("household_id", householdId)
      .maybeSingle(),
    supabase
      .from("members")
      .select("id, name, kind, birthdate, portion_override, archived, user_id")
      .eq("household_id", householdId)
      .order("name"),
    supabase.from("pantry").select("ingredient_key, qty").eq("household_id", householdId),
    supabase
      .from("freezer")
      .select("recipe_id, portions, frozen_at")
      .eq("household_id", householdId)
      .order("frozen_at"),
    supabase.from("ratings").select("recipe_id, value").eq("household_id", householdId),
    supabase
      .from("weeks")
      .select("id, start_date, status, plan, pasta_need, pantry_done")
      .eq("household_id", householdId)
      .order("start_date", { ascending: false })
      .limit(8),
  ]);
  if (household.error) throw household.error;
  const memberRows = members.data ?? [];
  const presence = memberRows.length
    ? await supabase
        .from("presence_rules")
        .select("member_id, weekday, meal, present, week_parity")
        .in(
          "member_id",
          memberRows.map((m) => m.id),
        )
    : { data: [] };

  return {
    id: household.data.id,
    name: household.data.name,
    timezone: household.data.timezone,
    alternatingFrom: household.data.alternating_from,
    onboardedAt: household.data.onboarded_at,
    settings: parseSettings(settings.data),
    members: memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      birthdate: m.birthdate,
      portionOverride: m.portion_override,
      archived: m.archived,
    })),
    presence: (presence.data ?? []).map((p) => ({
      memberId: p.member_id,
      weekday: p.weekday,
      meal: p.meal,
      present: p.present,
      weekParity: p.week_parity,
    })),
    pantry: Object.fromEntries(
      (pantry.data ?? []).map((p) => [p.ingredient_key, p.qty === null ? null : Number(p.qty)]),
    ),
    bank: (freezer.data ?? []).map((f) => ({
      recipeId: f.recipe_id,
      portions: f.portions,
      frozenAt: f.frozen_at,
    })),
    ratings: Object.fromEntries((ratings.data ?? []).map((r) => [r.recipe_id, r.value as 1 | -1])),
    weeks: (weeks.data ?? []) as WeekRow[],
  };
});

export function portionModelFor(ctx: HouseholdContext, weekStart: string) {
  return householdPortions({
    members: ctx.members,
    presence: ctx.presence,
    weekStart,
    alternatingFrom: ctx.alternatingFrom,
  });
}
