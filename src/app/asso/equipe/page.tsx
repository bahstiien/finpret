import type { Metadata } from "next";
import { InviteEditorForm } from "@/components/asso/InviteEditorForm";
import { ActionForm } from "@/components/ui/ActionForm";
import { fr } from "@/i18n/fr";
import { withSession } from "@/server/session";
import { removeEditor, revokeEditorInvitation } from "@/server/actions/asso";
import { requireManager } from "@/server/asso-session";
import { emailOf } from "@/server/users";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";

const t = fr.asso.team;

export const metadata: Metadata = { title: t.title };

/** Équipe : responsable et éditeurs de menus (3 au plus), invitations en attente. */
export default async function TeamPage() {
  const association = await requireManager();
  const { members, invitations } = await withSession(async (db) => ({
    members: await db
      .selectFrom("association_members")
      .select(["user_id", "role"])
      .where("association_id", "=", association.id)
      .execute(),
    invitations: await db
      .selectFrom("association_invitations")
      .select(["id", "email", "expires_at"])
      .where("association_id", "=", association.id)
      .where("accepted_at", "is", null)
      .where("expires_at", ">", new Date().toISOString())
      .execute(),
  }));
  // L'e-mail d'un membre de sa propre équipe est lisible du responsable (lecture privilégiée, réservée au serveur).
  const people = await Promise.all(
    members.map(async (m) => ({
      ...m,
      email: (await emailOf(m.user_id)) ?? "",
    })),
  );
  return (
    <>
      <PageHeader title={t.title} />
      <p className="text-muted">{t.lead}</p>
      <Card padding="cozy" aria-label={t.members}>
        <h2 className="mb-3 text-xl font-extrabold">{t.members}</h2>
        <ul className="flex flex-col divide-y divide-line">
          {people.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <b>{m.email}</b> · {m.role === "manager" ? t.manager : t.editor}
              </span>
              {m.role === "menu_editor" && (
                <ActionForm
                  action={removeEditor}
                  fields={{ userId: m.user_id }}
                  label={t.remove}
                  confirm={t.remove}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card padding="cozy" className="flex flex-col gap-4">
        <h2 className="text-xl font-extrabold">{t.invite}</h2>
        <InviteEditorForm />
      </Card>
      <Card padding="cozy" aria-label={t.pending} data-testid="asso-invitations">
        <h2 className="mb-3 text-xl font-extrabold">{t.pending}</h2>
        {!invitations.length && <p className="text-muted">{t.none}</p>}
        <ul className="flex flex-col divide-y divide-line">
          {invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>{i.email}</span>
              <ActionForm action={revokeEditorInvitation} fields={{ invitationId: i.id }} label={t.revoke} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
