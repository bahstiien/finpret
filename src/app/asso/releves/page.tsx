import type { Metadata } from "next";
import { IbanForm } from "@/components/asso/IbanForm";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/server/asso-session";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";

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
      <p className="muted">{t.lead}</p>
      {association.status === "approved" ? (
        <IbanForm last4={association.ibanLast4} />
      ) : (
        <Card as="p" tone="yellow" className="t-ui">
          {t.ibanMissing}
        </Card>
      )}
      <Card aria-label={t.title}>
        {!data?.length && <p className="muted">{t.none}</p>}
        <ul>
          {(data ?? []).map((p) => (
            <li key={p.id} className="row flex-wrap justify-between">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <b className="mono">{p.quarter}</b> · <span className="mono">{euros.format(p.amount_cents / 100)}</span> ·{" "}
                <Pill tone={p.status === "paid" ? "green" : "chip"}>{t.statuses[p.status]}</Pill>
              </span>
              {p.statement_path && (
                <a href={`/asso/releves/${p.id}/pdf`} className="lnk">
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
