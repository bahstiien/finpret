import "server-only";
import { cache } from "react";
import { sql } from "kysely";
import { type Db, withAdmin } from "@/server/db";
import { type CanContext, can, type Feature, type HouseholdOffer, type Plan } from "@/server/entitlements";
import { withSession } from "@/server/session";

/** Offre d'un foyer : abonnement (table `subscriptions`) et rattachement à une association. `client` : tâches planifiées. */
export const loadOffer = cache(async (householdId: string, client?: Db): Promise<HouseholdOffer> =>
  client ? load(client, householdId) : withSession((db) => load(db, householdId)),
);

async function load(db: Db, householdId: string): Promise<HouseholdOffer> {
  const subscription = await db
    .selectFrom("subscriptions")
    .select(["plan", "status", "trial_ends_at"])
    .where("household_id", "=", householdId)
    .executeTakeFirst();
  const household = await db
    .selectFrom("households")
    .select("association_id")
    .where("id", "=", householdId)
    .executeTakeFirst();
  return {
    plan: (subscription?.plan ?? "free") as Plan,
    status: subscription?.status ?? "canceled",
    trialEndsAt: subscription?.trial_ends_at ?? null,
    associationId: household?.association_id ?? null,
  };
}

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
  const { n } = await withAdmin((db) =>
    db
      .selectFrom("events")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("name", "=", "menu_swap")
      .where("household_id", "=", householdId)
      .where(sql`props->>'week'`, "=", weekId)
      .executeTakeFirstOrThrow(),
  );
  return Number(n);
}
