"use server";

import { z } from "zod";
import type { SessionRow } from "@/components/session/SessionProvider";
import { rpc } from "@/server/db";
import { withSession } from "@/server/session";

const week = z.uuid();
const commandSchema = z.discriminatedUnion("fn", [
  z.object({ fn: z.literal("session_start"), args: z.object({ p_week: week }) }),
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
