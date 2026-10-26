import type { Metadata } from "next";
import { IbanForm } from "@/components/asso/IbanForm";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/server/asso-session";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";

const t = fr.asso.statements;

export const metadata: Metadata = { title: t.title };

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Relevés trimestriels de reversement (lecture par le responsable). */
export default async function StatementsPage() {
  const association = await requireManager();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payouts")
    .select("id, quarter, amount_cents, status, statement_path")
    .eq("association_id", association.id)
    .order("quarter", { ascending: false });
  return (
    <>
      <PageHeader title={t.title} />
      <p className="text-muted">{t.lead}</p>
      {association.status === "approved" ? (
        <IbanForm last4={association.ibanLast4} />
      ) : (
        <Card as="p" padding="cozy">
          {t.ibanMissing}
        </Card>
      )}
      <Card padding="cozy" aria-label={t.title}>
        {!data?.length && <p className="text-muted">{t.none}</p>}
        <ul className="flex flex-col divide-y divide-line">
          {(data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <b>{p.quarter}</b> · {euros.format(p.amount_cents / 100)} · {t.statuses[p.status]}
              </span>
              {p.statement_path && (
                <a href={`/asso/releves/${p.id}/pdf`} className="font-semibold underline">
                  {t.download}
                </a>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
