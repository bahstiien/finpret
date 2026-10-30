import "server-only";
import { sql } from "kysely";
import { withAdmin } from "@/server/db";

export const MAX_IMPORTS_PER_MONTH = 8;

/** Imports de PDF déjà faits ce mois-ci par une association (journal `events`). */
export async function importsThisMonth(associationId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const row = await withAdmin((db) =>
    db
      .selectFrom("events")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("name", "=", "canteen_pdf_import")
      .where(sql<string>`props->>'association'`, "=", associationId)
      .where("created_at", ">=", start.toISOString())
      .executeTakeFirst(),
  );
  return Number(row?.n ?? 0);
}
