import "server-only";
import { previousQuarter } from "@/engine/payouts";
import { todayIn } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendStatement } from "@/server/emails";
import { type ClosingSummary, closeQuarter } from "@/server/payouts";
import { renderStatementPdf } from "@/server/pdf/statement-pdf";

const BUCKET = "asso-statements";

/**
 * Clôture trimestrielle réelle : relevé PDF rangé dans Storage (`asso-statements/[association]/[trimestre].pdf`),
 * e-mail au bureau avec le PDF. Appelée par la tâche planifiée du 1er janvier, avril, juillet et octobre à 03:00
 * (Europe/Paris) ; sans danger si elle est rejouée.
 */
export async function runQuarterClosing(quarter?: string, now = new Date()): Promise<ClosingSummary> {
  const db = createAdminClient();
  const target = quarter ?? previousQuarter(todayIn("Europe/Paris", now));
  // Le bucket est créé au premier besoin (privé).
  await db.storage.createBucket(BUCKET, { public: false }).catch(() => null);
  const pdfs = new Map<string, Buffer>();
  return closeQuarter(db, target, {
    writeStatement: async (input) => {
      const pdf = await renderStatementPdf(input);
      pdfs.set(input.associationId, pdf);
      const path = `${input.associationId}/${input.quarter}.pdf`;
      const { error } = await db.storage
        .from(BUCKET)
        .upload(path, pdf, { contentType: "application/pdf", upsert: true });
      return error ? null : path;
    },
    notifyReady: async (input) => {
      await sendStatement(input, pdfs.get(input.associationId) ?? null).catch(() => null);
    },
  });
}
