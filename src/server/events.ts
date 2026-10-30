import "server-only";
import { sql } from "kysely";
import { type EventName, ONCE_PER_USER } from "@/lib/events";
import { json, withAdmin } from "@/server/db";
import type { Json } from "@/server/db.types";

export type TrackOptions = {
  userId?: string | null;
  householdId?: string | null;
  props?: Record<string, Json>;
  /** Ne pas enregistrer si un événement du même nom existe déjà pour ce couple (compte ou foyer) et cette semaine/clé. */
  dedupeKey?: string;
};

/**
 * Enregistre un événement d'indicateur. Ne bloque jamais le parcours : une erreur est journalisée puis ignorée.
 * Écrit avec la clé de service (la table `events` n'a aucun accès client).
 */
export async function trackEvent(name: EventName, options: TrackOptions = {}): Promise<void> {
  try {
    const { userId = null, householdId = null, props = {}, dedupeKey } = options;
    const once = ONCE_PER_USER.includes(name);
    await withAdmin(async (db) => {
      if (once || dedupeKey) {
        let query = db
          .selectFrom("events")
          .select((eb) => eb.fn.countAll<number>().as("n"))
          .where("name", "=", name);
        if (userId) query = query.where("user_id", "=", userId);
        else if (householdId) query = query.where("household_id", "=", householdId);
        if (dedupeKey) query = query.where(sql`props->>'key'`, "=", dedupeKey);
        const { n } = await query.executeTakeFirstOrThrow();
        if (Number(n)) return;
      }
      await db
        .insertInto("events")
        .values({
          name,
          user_id: userId,
          household_id: householdId,
          props: json(dedupeKey ? { ...props, key: dedupeKey } : props),
        })
        .execute();
    });
  } catch (error) {
    console.error(`événement ${name} non enregistré :`, error);
  }
}
