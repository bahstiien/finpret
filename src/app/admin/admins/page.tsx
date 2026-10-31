import Link from "next/link";
import { formatShort } from "@/lib/dates";
import { grantAdmin, resetAdminMfa, revokeAdmin } from "@/server/actions/crm";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { ActionForm } from "@/components/ui/ActionForm";
import { AdminForm } from "@/components/admin/AdminForm";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const ROLES: [string, string][] = [
  ["support", "Support (lecture seule)"],
  ["owner", "Complet"],
];

/** Équipe du back-office : nommer, changer le rôle, retirer un administrateur, réinitialiser son second facteur. */
export default async function AdminTeamPage() {
  const { user, role } = await requireAdmin();
  const canWrite = role === "owner";
  const admins = await withAdmin((db) =>
    db
      .selectFrom("admins as a")
      .innerJoin("auth.users as u", "u.id", "a.user_id")
      .leftJoin("auth.admin_totp as t", "t.user_id", "a.user_id")
      .select(["a.user_id", "a.role", "a.created_at", "u.email", "t.verified_at as mfa_at"])
      .orderBy("a.created_at")
      .execute(),
  );
  return (
    <>
      <PageHeader title="Administrateurs" description="Le rôle Support consulte tout mais ne modifie rien." />
      {canWrite && (
        <Card>
          <AdminForm
            action={grantAdmin}
            inputs={[
              { name: "email", label: "E-mail du compte", type: "email", required: true },
              { name: "role", label: "Rôle", type: "select", options: ROLES },
            ]}
            submit="Nommer / changer le rôle"
            variant="primary"
            resetOnSuccess
          />
        </Card>
      )}
      <Card as="ul" className="!shadow-none">
        {admins.map((a) => (
          <li key={a.user_id} className="row t-small flex-wrap items-center justify-between gap-2">
            <span>
              <Link href={`/admin/comptes/${a.user_id}`} className="underline">
                <b>{a.email}</b>
              </Link>
              {a.user_id === user.id ? " (toi)" : ""}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone={a.role === "owner" ? "violet" : "chip"}>{a.role === "owner" ? "complet" : "support"}</Pill>
              <span className="mono muted">
                TOTP {a.mfa_at ? "activé" : "à activer"} · depuis le {formatShort(a.created_at.slice(0, 10))}
              </span>
              {canWrite && (
                <>
                  <ActionForm
                    action={resetAdminMfa}
                    fields={{ userId: a.user_id }}
                    label="Réinitialiser le TOTP"
                    confirm="Supprimer le second facteur de cet administrateur ?"
                  />
                  {a.user_id !== user.id && (
                    <ActionForm
                      action={revokeAdmin}
                      fields={{ userId: a.user_id }}
                      label="Retirer"
                      confirm="Retirer les droits d'administrateur ?"
                    />
                  )}
                </>
              )}
            </span>
          </li>
        ))}
      </Card>
    </>
  );
}
