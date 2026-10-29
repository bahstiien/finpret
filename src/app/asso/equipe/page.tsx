import type { Metadata } from "next";
import { InviteEditorForm } from "@/components/asso/InviteEditorForm";
import { ActionForm } from "@/components/ui/ActionForm";
import { fr } from "@/i18n/fr";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { removeEditor, revokeEditorInvitation } from "@/server/actions/asso";
import { requireManager } from "@/server/asso-session";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";

const t = fr.asso.team;

export const metadata: Metadata = { title: t.title };

/** Équipe : responsable et éditeurs de menus (3 au plus), invitations en attente. */
export default async function TeamPage() {
  const association = await requireManager();
  const supabase = await createClient();
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from("association_members").select("user_id, role").eq("association_id", association.id),
    supabase
      .from("association_invitations")
      .select("id, email, expires_at")
      .eq("association_id", association.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  // L'e-mail d'un membre de sa propre équipe est lisible du responsable (clé de service, réservée au serveur).
  const admin = createAdminClient();
  const people = await Promise.all(
    (members ?? []).map(async (m) => ({
      ...m,
      email: (await admin.auth.admin.getUserById(m.user_id)).data.user?.email ?? "",
    })),
  );
  return (
    <>
      <PageHeader title={t.title} />
      <p className="muted">{t.lead}</p>
      <Card aria-label={t.members}>
        <h2 className="t-2 mb-3">{t.members}</h2>
        <ul>
          {people.map((m) => (
            <li key={m.user_id} className="row flex-wrap justify-between">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <b className="t-ui [overflow-wrap:anywhere]">{m.email}</b>
                <Pill tone={m.role === "manager" ? "violet" : "chip"}>
                  {m.role === "manager" ? t.manager : t.editor}
                </Pill>
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
      <Card className="flex flex-col gap-4">
        <h2 className="t-2">{t.invite}</h2>
        <InviteEditorForm />
      </Card>
      <Card aria-label={t.pending} data-testid="asso-invitations">
        <h2 className="t-2 mb-3">{t.pending}</h2>
        {!invitations?.length && <p className="muted">{t.none}</p>}
        <ul>
          {(invitations ?? []).map((i) => (
            <li key={i.id} className="row flex-wrap justify-between">
              <span className="t-body [overflow-wrap:anywhere]">{i.email}</span>
              <ActionForm action={revokeEditorInvitation} fields={{ invitationId: i.id }} label={t.revoke} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
