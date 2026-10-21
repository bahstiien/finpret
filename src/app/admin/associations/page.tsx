import { RejectForm } from "@/components/admin/RejectForm";
import { ActionForm } from "@/components/ui/ActionForm";
import { checkAssociationEmail, checkRnaOrSiren } from "@/lib/rna";
import { approveAssociation, setAssociationSuspended } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { Card } from "@/components/ui/Card";

const STATUS = {
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
  suspended: "Suspendue",
} as const;

/** Validation des associations : contrôle du RNA/SIREN et de l'e-mail, puis validation ou refus motivé. */
export default async function AdminAssociationsPage() {
  const { db } = await requireAdmin();
  const { data } = await db
    .from("associations")
    .select("id, name, rna_or_siren, email, manager_name, code, status, reject_reason, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const order = { pending: 0, approved: 1, suspended: 2, rejected: 3 } as const;
  const rows = [...(data ?? [])].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <>
      <h1 className="text-4xl font-black">Associations</h1>
      {!rows.length && <p className="text-muted">Aucune association pour l&apos;instant.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((a) => {
          const rna = checkRnaOrSiren(a.rna_or_siren);
          const mail = checkAssociationEmail(a.email);
          return (
            <Card
              as="li"
              padding="cozy"
              key={a.id}
              className="flex flex-col gap-3"
              data-testid={`asso-${a.code}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-extrabold">{a.name}</h2>
                <span className="rounded-pill bg-chip px-3 py-1 text-sm font-bold">{STATUS[a.status]}</span>
              </div>
              <p className="text-sm">
                Code <b>{a.code}</b> · {a.manager_name} · {a.email}
              </p>
              <p className="text-sm">
                {a.rna_or_siren} :{" "}
                <b className={rna.valid ? "text-green-ink" : "text-peach-ink"}>{rna.message}</b> · E-mail :{" "}
                <b className={mail.valid ? "text-green-ink" : "text-peach-ink"}>{mail.message}</b>
              </p>
              {a.reject_reason && <p className="text-sm text-muted">Motif : {a.reject_reason}</p>}
              <div className="flex flex-wrap items-end gap-3">
                {(a.status === "pending" || a.status === "rejected") && (
                  <ActionForm
                    action={approveAssociation}
                    fields={{ id: a.id }}
                    label="Valider"
                    variant="primary"
                  />
                )}
                {a.status === "pending" && <RejectForm id={a.id} />}
                {a.status === "approved" && (
                  <ActionForm
                    action={setAssociationSuspended}
                    fields={{ id: a.id, suspended: "1" }}
                    label="Suspendre"
                    confirm="Suspendre cette association ?"
                  />
                )}
                {a.status === "suspended" && (
                  <ActionForm
                    action={setAssociationSuspended}
                    fields={{ id: a.id, suspended: "0" }}
                    label="Réactiver"
                  />
                )}
              </div>
            </Card>
          );
        })}
      </ul>
    </>
  );
}
