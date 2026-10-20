import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Db } from "@/lib/supabase/types";
import { type CanContext, can, type Feature, type HouseholdOffer, type Plan } from "@/server/entitlements";

/** Offre d'un foyer : abonnement (table `subscriptions`) et rattachement à une association. `client` : tâches planifiées. */
export const loadOffer = cache(async (householdId: string, client?: Db): Promise<HouseholdOffer> => {
  const supabase = client ?? (await createClient());
  const [subscription, household] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, status, trial_ends_at")
      .eq("household_id", householdId)
      .maybeSingle(),
    supabase.from("households").select("association_id").eq("id", householdId).maybeSingle(),
  ]);
  return {
    plan: (subscription.data?.plan ?? "free") as Plan,
    status: subscription.data?.status ?? "canceled",
    trialEndsAt: subscription.data?.trial_ends_at ?? null,
    associationId: household.data?.association_id ?? null,
  };
});

/** `can()` pour un foyer, avec son offre lue en base. Le serveur reste l'autorité (CLAUDE.md). */
export async function householdCan(
  householdId: string,
  feature: Feature,
  ctx: CanContext = {},
  client?: Db,
): Promise<boolean> {
  return can(await loadOffer(householdId, client), feature, ctx);
}

/** Changements de plat (« Changer ») déjà faits pour une semaine : journalisés dans `events` (SPEC_JANVIER §4). */
export async function swapsUsed(householdId: string, weekId: string): Promise<number> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { count } = await createAdminClient()
    .from("events")
    .select("id", { head: true, count: "exact" })
    .eq("name", "menu_swap")
    .eq("household_id", householdId)
    .eq("props->>week", weekId);
  return count ?? 0;
}
