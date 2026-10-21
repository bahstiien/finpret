import "server-only";
import { stockPerWeek } from "@/engine/allocation";
import type { Env } from "@/engine/env";
import {
  listOccurrences,
  lockedUids,
  type Occurrence,
  type PreparationState,
  sumNeeds,
} from "@/engine/occurrences";
import type { Pantry } from "@/engine/types";
import { createClient } from "@/lib/supabase/server";
import { type HouseholdContext, portionModelFor, type WeekRow } from "@/server/household-context";

/** Allocation des ressources du foyer entre les semaines et état de verrouillage des préparations. */

/**
 * Garde-manger visible par une semaine : le stock déjà réservé par les semaines précédentes (draft ou active)
 * est retiré (AC-11). Un stock « assez » déjà revendiqué par une semaine précédente devient « à vérifier » (AC-25).
 */
export function pantryForWeek(
  ctx: HouseholdContext,
  env: Env,
  week: Pick<WeekRow, "id" | "start_date">,
): { pantry: Pantry; unverified: Set<string> } {
  const earlier = ctx.weeks
    .filter((w) => w.status !== "done" && w.start_date < week.start_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const cakeOn = ctx.settings.menu.cake.enabled;
  const needs = [...earlier, week].map((w) => {
    const row = ctx.weeks.find((x) => x.id === w.id) ?? (w as WeekRow);
    const plan = row.plan;
    return sumNeeds(listOccurrences(env, plan, portionModelFor(ctx, plan.start), cakeOn));
  });
  const slices = stockPerWeek(ctx.pantry, needs);
  const mine = slices[slices.length - 1]!;
  const pantry: Pantry = {};
  for (const [k, v] of Object.entries(mine.available)) if (v !== undefined) pantry[k] = v;
  return { pantry, unverified: mine.unverified };
}

export type LockState = {
  sessionStarted: boolean;
  states: Record<string, PreparationState>;
};

export async function loadLockState(weekId: string): Promise<LockState> {
  const supabase = await createClient();
  const [session, prep] = await Promise.all([
    supabase.from("sessions").select("started_at").eq("week_id", weekId).maybeSingle(),
    supabase.from("preparation_states").select("uid, state").eq("week_id", weekId),
  ]);
  if (session.error) throw session.error;
  if (prep.error) throw prep.error;
  return {
    sessionStarted: !!session.data?.started_at,
    states: Object.fromEntries((prep.data ?? []).map((r) => [r.uid, r.state as PreparationState])),
  };
}

export const lockedFor = (occ: readonly Occurrence[], lock: LockState) =>
  lockedUids(occ, lock.states, lock.sessionStarted);

/** Vrai si au moins une préparation de la semaine est protégée : une régénération complète est alors refusée. */
export const hasAnyLock = (lock: LockState) => lock.sessionStarted || Object.keys(lock.states).length > 0;
