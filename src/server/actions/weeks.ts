"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { isoWeekday } from "@/lib/dates";
import type { ActionResult } from "@/server/errors";
import { requireHousehold } from "@/server/session";
import { generateAndStore } from "@/server/weeks";

const startSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => isoWeekday(d) === 1);

/** « Préparer ma semaine » / « Générer à nouveau » pour un lundi donné. */
export async function generateWeekAction(start: string): Promise<ActionResult<{ meals: number }>> {
  const { household } = await requireHousehold("/app");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  const parsed = startSchema.safeParse(start);
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  const res = await generateAndStore(household.id, parsed.data);
  if (!res.ok)
    return { ok: false, error: res.reason === "forbidden" ? fr.errors.forbidden : fr.menu.impossible };
  revalidatePath("/app", "layout");
  return { ok: true, data: { meals: res.summary.meals } };
}
