import "server-only";
import { type EventName, ONCE_PER_USER } from "@/lib/events";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const db = createAdminClient();
    const once = ONCE_PER_USER.includes(name);
    if (once || dedupeKey) {
      let query = db.from("events").select("id", { head: true, count: "exact" }).eq("name", name);
      if (userId) query = query.eq("user_id", userId);
      else if (householdId) query = query.eq("household_id", householdId);
      if (dedupeKey) query = query.eq("props->>key", dedupeKey);
      const { count } = await query;
      if (count) return;
    }
    const { error } = await db.from("events").insert({
      name,
      user_id: userId,
      household_id: householdId,
      props: dedupeKey ? { ...props, key: dedupeKey } : props,
    });
    if (error) console.error(`événement ${name} non enregistré :`, error.message);
  } catch (error) {
    console.error(`événement ${name} non enregistré :`, error);
  }
}
