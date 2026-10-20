"use server";

import { z } from "zod";
import { trackEvent } from "@/server/events";
import { requireHousehold } from "@/server/session";

const schema = z.object({
  name: z.enum(["session_started", "session_done", "shopping_checked"]),
  weekId: z.uuid(),
});

/**
 * Événements déclenchés depuis l'interface (la session et les courses écrivent directement dans Supabase).
 * Un seul enregistrement par compte, événement et semaine ; la semaine doit appartenir au foyer (RLS).
 */
export async function recordWeekEvent(name: string, weekId: string): Promise<void> {
  const parsed = schema.safeParse({ name, weekId });
  if (!parsed.success) return;
  const { user, household } = await requireHousehold("/app");
  await trackEvent(parsed.data.name, {
    userId: user.id,
    householdId: household.id,
    dedupeKey: parsed.data.weekId,
  });
}
