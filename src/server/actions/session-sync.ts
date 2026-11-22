"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SessionRow } from "@/components/session/SessionProvider";
import { json, rpc } from "@/server/db";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold, withSession } from "@/server/session";
import { freezeSnapshot } from "@/server/session-plan";

const week = z.uuid();
const commandSchema = z.discriminatedUnion("fn", [
  z.object({
    fn: z.literal("session_set_step"),
    args: z.object({ p_week: week, p_step: z.int().min(0).max(100) }),
  }),
  z.object({
    fn: z.literal("session_set_task"),
    args: z.object({ p_week: week, p_key: z.string().min(1).max(200), p_done: z.boolean() }),
  }),
  z.object({
    fn: z.literal("session_start_timer"),
    args: z.object({
      p_week: week,
      p_id: z.uuid(),
      p_label: z.string().min(1).max(200),
      p_minutes: z
        .int()
        .min(1)
        .max(24 * 60),
      p_step: z.int().min(0).max(100),
    }),
  }),
  z.object({
    fn: z.literal("session_timer"),
    args: z.object({ p_week: week, p_id: z.string().min(1).max(100), p_action: z.string().min(1).max(20) }),
  }),
]);

export type SessionCommand = z.infer<typeof commandSchema>;

/** Écritures de la session de cuisine (fonctions SQL soumises à la RLS du foyer). */
export async function runSessionCommand(input: SessionCommand): Promise<void> {
  const command = commandSchema.parse(input);
  await withSession((db) => rpc(db, command.fn, command.args));
}

/**
 * « Commencer ma session » : démarre la session et fige la semaine (menu, portions, étapes, courses du menu).
 * Une semaine déjà figée le reste tel quel.
 */
export async function startSessionAction(weekId: string): Promise<void> {
  if (!week.safeParse(weekId).success) return;
  const { household } = await requireHousehold("/app/session");
  if (household.role === "viewer") return;
  const ctx = await loadHouseholdContext(household.id);
  const row = ctx.weeks.find((w) => w.id === weekId);
  if (!row) return;
  const frozen = row.frozen ? null : await freezeSnapshot(ctx, row);
  await withSession(async (db) => {
    await rpc(db, "session_start", { p_week: weekId });
    if (frozen) {
      await db
        .updateTable("weeks")
        .set({ frozen: json(frozen) })
        .where("id", "=", weekId)
        .where("frozen", "is", null)
        .execute();
    }
  });
  revalidatePath("/app", "layout");
}

/** État de la session de cuisine d'une semaine, relu par l'écran de session (retour sur l'onglet). */
export async function readSessionRow(weekId: string): Promise<SessionRow | null> {
  if (!z.uuid().safeParse(weekId).success) return null;
  const row = await withSession((db) =>
    db
      .selectFrom("sessions")
      .select(["week_id", "started_at", "current_step", "tasks_done", "timers", "updated_at"])
      .where("week_id", "=", weekId)
      .executeTakeFirst(),
  );
  return (row as unknown as SessionRow | undefined) ?? null;
}
