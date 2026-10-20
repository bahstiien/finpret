import "server-only";
import { decidePayout, previousQuarter, quarterBounds } from "@/engine/payouts";
import type { Db } from "@/lib/supabase/types";

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

  const { data } = await db
    .from("payout_lines")
    .select("id, association_id, kind, amount_cents, created_at")
    .is("payout_id", null)
    .lt("created_at", end);
  const lines = (data ?? []) as Line[];
  const byAssociation = new Map<string, Line[]>();
  for (const l of lines)
    byAssociation.set(l.association_id, [...(byAssociation.get(l.association_id) ?? []), l]);

  for (const [associationId, group] of byAssociation) {
    const { data: existing } = await db
      .from("payouts")
      .select("id")
      .eq("association_id", associationId)
      .eq("quarter", quarter)
      .maybeSingle();
    if (existing) {
      summary.skipped++;
      continue;
    }
    const total = group.reduce((s, l) => s + l.amount_cents, 0);
    const decision = decidePayout(total);
    const { data: association } = await db
      .from("associations")
      .select("name, email")
      .eq("id", associationId)
      .maybeSingle();
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

    const { error } = await db
      .from("payouts")
      .insert({ association_id: associationId, quarter, amount_cents: total, status: decision.status });
    if (error) {
      // Deux clôtures simultanées : l'unicité protège, l'autre passage a gagné.
      if (error.code === "23505") {
        summary.skipped++;
        continue;
      }
      throw new Error(`payouts : ${error.message}`);
    }
    summary.created++;

    if (decision.status === "carried_over") {
      summary.carried++;
      continue;
    }
    const { data: payout } = await db
      .from("payouts")
      .select("id")
      .eq("association_id", associationId)
      .eq("quarter", quarter)
      .single();
    if (payout) {
      for (const l of group) await db.from("payout_lines").update({ payout_id: payout.id }).eq("id", l.id);
      const path = await deps.writeStatement(input);
      if (path) await db.from("payouts").update({ statement_path: path }).eq("id", payout.id);
      await deps.notifyReady(input, path);
    }
    summary.ready++;
  }
  return summary;
}

/** Trimestre à clôturer à la date `now` : celui qui vient de s'achever. */
export const quarterToClose = (nowIso: string) => previousQuarter(nowIso);
