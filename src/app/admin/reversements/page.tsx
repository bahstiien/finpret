import { ActionForm } from "@/components/ui/ActionForm";
import { formatShort } from "@/lib/dates";
import { markPayoutPaid } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const STATUS = { ready: "À verser", paid: "Versé", carried_over: "Reporté" } as const;

/** Reversements trimestriels : export CSV (IBAN déchiffré), « Marquer comme payé » (relevé PDF envoyé). */
export default async function AdminPayoutsPage() {
  const { db } = await requireAdmin();
  const { data } = await db
    .from("payouts")
    .select("id, association_id, quarter, amount_cents, status, paid_at")
    .order("quarter", { ascending: false });
  const ids = [...new Set((data ?? []).map((p) => p.association_id))];
  const { data: assos } = ids.length
    ? await db.from("associations").select("id, name, iban_last4").in("id", ids)
    : { data: [] };
  const byId = new Map((assos ?? []).map((a) => [a.id, a]));
  const quarters = [...new Set((data ?? []).map((p) => p.quarter))];
  return (
    <>
      <PageHeader title="Reversements" />
      <div className="flex flex-wrap gap-2">
        {quarters.map((q) => (
          <a
            key={q}
            href={`/admin/reversements/export?quarter=${q}`}
            className="btn btn--outline btn--sm"
          >
            Export CSV {q}
          </a>
        ))}
      </div>
      <Card as="ul" className="!shadow-none">
        {(data ?? []).map((p) => {
          const a = byId.get(p.association_id);
          return (
            <li
              key={p.id}
              className="row flex-wrap justify-between"
              data-testid={`payout-${p.quarter}`}
            >
              <span>
                <b>{a?.name ?? "?"}</b> · <span className="mono">{p.quarter}</span> ·{" "}
                <span className="mono">{euros.format(p.amount_cents / 100)}</span> · {STATUS[p.status]}
                {p.paid_at ? ` le ${formatShort(p.paid_at.slice(0, 10))}` : ""}
                {a?.iban_last4 ? ` · IBAN •••• ${a.iban_last4}` : " · IBAN manquant"}
              </span>
              {p.status === "ready" && (
                <ActionForm
                  action={markPayoutPaid}
                  fields={{ id: p.id }}
                  label="Marquer comme payé"
                  variant="primary"
                  confirm="Confirmer que le virement a été effectué ?"
                />
              )}
            </li>
          );
        })}
        {!data?.length && <li className="muted">Aucun versement.</li>}
      </Card>
    </>
  );
}
