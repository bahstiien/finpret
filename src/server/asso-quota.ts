import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_IMPORTS_PER_MONTH = 8;

/** Imports de PDF déjà faits ce mois-ci par une association (journal `events`). */
export async function importsThisMonth(associationId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await createAdminClient()
    .from("events")
    .select("id", { head: true, count: "exact" })
    .eq("name", "canteen_pdf_import")
    .eq("props->>association", associationId)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}
