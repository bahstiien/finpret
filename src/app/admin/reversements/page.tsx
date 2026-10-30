import { ActionForm } from "@/components/ui/ActionForm";
import { formatShort } from "@/lib/dates";
import { markPayoutPaid } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const STATUS = { ready: "À verser", paid: "Versé", carried_over: "Reporté" } as const;

/** Reversements trimestriels : export CSV (IBAN déchiffré), « Marquer comme payé » (relevé PDF envoyé). */
export default async function AdminPayoutsPage() {
  await requireAdmin();
  const { data, assos } = await withAdmin(async (db) => {
    const data = await db
      .selectFrom("payouts")
      .select(["id", "association_id", "quarter", "amount_cents", "status", "paid_at"])
      .orderBy("quarter", "desc")
      .execute();
    const ids = [...new Set(data.map((p) => p.association_id))];
    const assos = ids.length
      ? await db
          .selectFrom("associations")
          .select(["id", "name", "iban_last4"])
          .where("id", "in", ids)
          .execute()
      : [];
    return { data, assos };
  });
  const byId = new Map(assos.map((a) => [a.id, a]));
  const quarters = [...new Set(data.map((p) => p.quarter))];
  return (
    <>
      <PageHeader title="Reversements" />
      <div className="flex flex-wrap gap-2">
        {quarters.map((q) => (
          <a
            key={q}
            href={`/admin/reversements/export?quarter=${q}`}
            className="inline-flex min-h-11 items-center rounded-pill border-2 border-ink px-4 font-bold"
          >
            Export CSV {q}
          </a>
        ))}
      </div>
      <Card as="ul" padding="cozy" className="flex flex-col divide-y divide-line">
        {data.map((p) => {
          const a = byId.get(p.association_id);
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
              data-testid={`payout-${p.quarter}`}
            >
              <span>
                <b>{a?.name ?? "?"}</b> · {p.quarter} · {euros.format(p.amount_cents / 100)} ·{" "}
                {STATUS[p.status]}
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
        {!data.length && <li className="text-muted">Aucun versement.</li>}
      </Card>
    </>
  );
}
