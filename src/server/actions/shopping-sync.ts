"use server";

import { z } from "zod";
import type { QueuedOp } from "@/lib/offline-queue";
import { withSession } from "@/server/session";

/**
 * Liste de courses lue et modifiée depuis l'écran des courses (file d'attente hors ligne comprise).
 * Remplace les accès directs du navigateur à la base : la RLS s'applique toujours, au nom de l'utilisateur connecté.
 */

const uuid = z.uuid();

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("check"), id: uuid, checked: z.boolean() }),
  z.object({ op: z.literal("delete"), id: uuid }),
  z.object({
    op: z.literal("add"),
    item: z.object({
      id: uuid,
      household_id: uuid,
      week_id: uuid,
      source: z.enum(["manual", "pantry_check"]),
      ingredient_key: z.string().max(80).nullable(),
      label: z.string().max(200).nullable(),
      qty_text: z.string().max(80).nullable(),
      aisle: z.string().min(1).max(80),
    }),
  }),
]);

export async function listShoppingItems(weekId: string) {
  if (!uuid.safeParse(weekId).success) return [];
  return withSession((db) =>
    db
      .selectFrom("shopping_items")
      .select([
        "id",
        "source",
        "ingredient_key",
        "label",
        "qty_text",
        "aisle",
        "checked",
        "added_by",
        "updated_at",
      ])
      .where("week_id", "=", weekId)
      .execute(),
  );
}

/**
 * Applique une opération de la file. `dropped` : refusée (droits, données) et à ne pas rejouer.
 * Une coupure réseau fait échouer l'appel lui-même côté navigateur : l'opération reste alors en file.
 */
export async function applyShoppingOp(input: QueuedOp): Promise<"sent" | "dropped"> {
  const parsed = opSchema.safeParse(input);
  if (!parsed.success) return "dropped";
  const op = parsed.data;
  try {
    await withSession(async (db) => {
      if (op.op === "check")
        await db.updateTable("shopping_items").set({ checked: op.checked }).where("id", "=", op.id).execute();
      else if (op.op === "delete") await db.deleteFrom("shopping_items").where("id", "=", op.id).execute();
      else
        await db
          .insertInto("shopping_items")
          .values(op.item)
          .onConflict((oc) => oc.column("id").doNothing())
          .execute();
    });
    return "sent";
  } catch {
    return "dropped";
  }
}
