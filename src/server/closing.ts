import "server-only";
import { previousQuarter } from "@/engine/payouts";
import { todayIn } from "@/lib/dates";
import { withAdmin } from "@/server/db";
import { sendStatement } from "@/server/emails";
import { storeFile } from "@/server/files";
import { type ClosingDeps, type ClosingSummary, closeQuarter } from "@/server/payouts";
import { renderStatementPdf } from "@/server/pdf/statement-pdf";

/**
 * Clôture trimestrielle réelle : relevé PDF rangé sur le disque (`asso-statements/[association]/[trimestre].pdf`),
 * e-mail au bureau avec le PDF. Appelée par la tâche planifiée du 1er janvier, avril, juillet et octobre à 03:00
 * (Europe/Paris) ; sans danger si elle est rejouée.
 */
export async function runQuarterClosing(quarter?: string, now = new Date()): Promise<ClosingSummary> {
  const target = quarter ?? previousQuarter(todayIn("Europe/Paris", now));
  const pdfs = new Map<string, Buffer>();
  // Toute la clôture tient dans une transaction : les e-mails ne partent qu'une fois les reversements enregistrés,
  // pour qu'un échec en cours de route (tout annulé, tâche rejouable) n'ait rien annoncé aux associations.
  const ready: Parameters<ClosingDeps["notifyReady"]>[0][] = [];
  const summary = await withAdmin((db) =>
    closeQuarter(db, target, {
      writeStatement: async (input) => {
        const pdf = await renderStatementPdf(input);
        pdfs.set(input.associationId, pdf);
        const path = `${input.associationId}/${input.quarter}.pdf`;
        return storeFile("asso-statements", path, pdf).then(
          () => path,
          () => null,
        );
      },
      notifyReady: async (input) => {
        ready.push(input);
      },
    }),
  );
  for (const input of ready)
    await sendStatement(input, pdfs.get(input.associationId) ?? null).catch(() => null);
  return summary;
}
