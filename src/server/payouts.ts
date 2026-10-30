import "server-only";
import { decidePayout, previousQuarter, quarterBounds } from "@/engine/payouts";
import type { Db } from "@/server/db";

export type ClosingDeps = {
  /** Relevé d'un versement prêt : génère le PDF, le range dans Storage et renvoie son chemin. */
  writeStatement: (input: StatementInput) => Promise<string | null>;
  /** E-mail du relevé au bureau de l'association (après génération du PDF). */
  notifyReady: (input: StatementInput, statementPath: string | null) => Promise<void>;
};

export type StatementInput = {
  associationId: string;
  associationName: string;
  associationEmail: string;
  quarter: string;
  amountCents: number;
  yearly: number;
  monthly: number;
  refunds: number;
};

export type ClosingSummary = {
  quarter: string;
  created: number;
  ready: number;
  carried: number;
  skipped: number;
};

type Line = { id: string; association_id: string; kind: string; amount_cents: number; created_at: string };

/**
 * Clôture d'un trimestre (SPEC_JANVIER §5) : somme des lignes non encore versées par association, y compris celles
 * reportées des trimestres précédents. Au moins 20 € → `ready` (lignes rattachées au versement, relevé PDF) ;
 * sinon `carried_over` (lignes laissées libres, elles s'ajouteront au trimestre suivant). Idempotent grâce à l'unicité
 * (association, trimestre) : un second passage ne recrée rien.
 */
export async function closeQuarter(db: Db, quarter: string, deps: ClosingDeps): Promise<ClosingSummary> {
  const { end } = quarterBounds(quarter);
  const summary: ClosingSummary = { quarter, created: 0, ready: 0, carried: 0, skipped: 0 };

  const lines: Line[] = await db
    .selectFrom("payout_lines")
    .select(["id", "association_id", "kind", "amount_cents", "created_at"])
    .where("payout_id", "is", null)
    .where("created_at", "<", end)
    .execute();
  const byAssociation = new Map<string, Line[]>();
  for (const l of lines)
    byAssociation.set(l.association_id, [...(byAssociation.get(l.association_id) ?? []), l]);

  for (const [associationId, group] of byAssociation) {
    const existing = await db
      .selectFrom("payouts")
      .select("id")
      .where("association_id", "=", associationId)
      .where("quarter", "=", quarter)
      .executeTakeFirst();
    if (existing) {
      summary.skipped++;
      continue;
    }
    const total = group.reduce((s, l) => s + l.amount_cents, 0);
    const decision = decidePayout(total);
    const association = await db
      .selectFrom("associations")
      .select(["name", "email"])
      .where("id", "=", associationId)
      .executeTakeFirst();
    const count = (kind: string) => group.filter((l) => l.kind === kind).length;
    const input: StatementInput = {
      associationId,
      associationName: association?.name ?? "",
      associationEmail: association?.email ?? "",
      quarter,
      amountCents: total,
      yearly: count("yearly"),
      monthly: count("monthly"),
      refunds: count("refund"),
    };

    const payout = await db
      .insertInto("payouts")
      .values({ association_id: associationId, quarter, amount_cents: total, status: decision.status })
      .onConflict((oc) => oc.columns(["association_id", "quarter"]).doNothing())
      .returning("id")
      .executeTakeFirst();
    // Deux clôtures simultanées : l'unicité protège, l'autre passage a gagné.
    if (!payout) {
      summary.skipped++;
      continue;
    }
    summary.created++;

    if (decision.status === "carried_over") {
      summary.carried++;
      continue;
    }
    await db
      .updateTable("payout_lines")
      .set({ payout_id: payout.id })
      .where(
        "id",
        "in",
        group.map((l) => l.id),
      )
      .execute();
    const path = await deps.writeStatement(input);
    if (path)
      await db.updateTable("payouts").set({ statement_path: path }).where("id", "=", payout.id).execute();
    await deps.notifyReady(input, path);
    summary.ready++;
  }
  return summary;
}

/** Trimestre à clôturer à la date `now` : celui qui vient de s'achever. */
export const quarterToClose = (nowIso: string) => previousQuarter(nowIso);
