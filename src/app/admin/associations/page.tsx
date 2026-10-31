import Link from "next/link";
import { AdminForm } from "@/components/admin/AdminForm";
import { RejectForm } from "@/components/admin/RejectForm";
import { ActionForm } from "@/components/ui/ActionForm";
import { checkAssociationEmail, checkRnaOrSiren } from "@/lib/rna";
import { approveAssociation, setAssociationSuspended } from "@/server/actions/admin";
import { createAssociationAsAdmin } from "@/server/actions/asso-admin";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill, type PillTone } from "@/components/ui/Pill";

const STATUS = {
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
  suspended: "Suspendue",
} as const;

const STATUS_TONE: Record<keyof typeof STATUS, PillTone> = {
  pending: "yellow",
  approved: "green",
  rejected: "pink",
  suspended: "peach",
};

/** Validation des associations : contrôle du RNA/SIREN et de l'e-mail, puis validation ou refus motivé. */
export default async function AdminAssociationsPage() {
  const { role } = await requireAdmin();
  const data = await withAdmin((db) =>
    db
      .selectFrom("associations")
      .select([
        "id",
        "name",
        "rna_or_siren",
        "email",
        "manager_name",
        "code",
        "status",
        "reject_reason",
        "created_at",
      ])
      .orderBy("created_at", "desc")
      .limit(200)
      .execute(),
  );
  const order = { pending: 0, approved: 1, suspended: 2, rejected: 3 } as const;
  const rows = [...data].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <>
      <PageHeader title="Associations" />
      {role === "owner" && (
        <Card className="flex flex-col gap-3">
          <h2 className="t-2">Créer une association</h2>
          <p className="t-small muted">
            L&apos;association est validée d&apos;emblée. Le responsable devient administrateur de l&apos;association et de
            son école ; son compte est créé au besoin et il reçoit le code et un lien de connexion.
          </p>
          <AdminForm
            action={createAssociationAsAdmin}
            inputs={[
              { name: "name", label: "Nom de l'association", required: true, placeholder: "APE Jules Ferry" },
              { name: "rna", label: "RNA / SIREN", required: true },
              { name: "managerName", label: "Nom du responsable", required: true },
              { name: "managerEmail", label: "E-mail du responsable", type: "email", required: true },
              { name: "schoolName", label: "École", required: true },
              { name: "city", label: "Ville", required: true },
              { name: "uai", label: "UAI de l'école (option)" },
              { name: "code", label: "Code (vide = généré)", placeholder: "APE-JULESFERRY" },
              { name: "yearly", label: "Rétribution annuel (€, vide = 8)", type: "number" },
              { name: "monthly", label: "Rétribution par mois (€, vide = 0,50)", type: "number" },
            ]}
            submit="Créer l'association"
            variant="primary"
            resetOnSuccess
          />
        </Card>
      )}
      {!rows.length && <p className="muted">Aucune association pour l&apos;instant.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((a) => {
          const rna = checkRnaOrSiren(a.rna_or_siren);
          const mail = checkAssociationEmail(a.email);
          return (
            <Card
              as="li"
              key={a.id}
              className="flex flex-col gap-3"
              data-testid={`asso-${a.code}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="t-2">
                  <Link href={`/admin/associations/${a.id}`} className="underline">
                    {a.name}
                  </Link>
                </h2>
                <Pill tone={STATUS_TONE[a.status]}>{STATUS[a.status]}</Pill>
              </div>
              <p className="t-small">
                Code <b className="mono">{a.code}</b> · {a.manager_name} · {a.email}
              </p>
              <p className="t-small">
                <span className="mono">{a.rna_or_siren}</span> :{" "}
                <b className={`px-1 ${rna.valid ? "tone-green" : "tone-pink"}`}>{rna.message}</b> · E-mail :{" "}
                <b className={`px-1 ${mail.valid ? "tone-green" : "tone-pink"}`}>{mail.message}</b>
              </p>
              {a.reject_reason && <p className="t-small muted">Motif : {a.reject_reason}</p>}
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
