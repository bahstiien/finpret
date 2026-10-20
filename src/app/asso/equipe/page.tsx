import type { Metadata } from "next";
import { InviteEditorForm } from "@/components/asso/InviteEditorForm";
import { ActionForm } from "@/components/ui/ActionForm";
import { fr } from "@/i18n/fr";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { removeEditor, revokeEditorInvitation } from "@/server/actions/asso";
import { requireManager } from "@/server/asso-session";

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
      <h1 className="text-4xl font-black">{t.title}</h1>
      <p className="text-muted">{t.lead}</p>
      <section className="rounded-card bg-surface p-5" aria-label={t.members}>
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
      </section>
      <section className="flex flex-col gap-4 rounded-card bg-surface p-5">
        <h2 className="text-xl font-extrabold">{t.invite}</h2>
        <InviteEditorForm />
      </section>
      <section className="rounded-card bg-surface p-5" aria-label={t.pending} data-testid="asso-invitations">
        <h2 className="mb-3 text-xl font-extrabold">{t.pending}</h2>
        {!invitations?.length && <p className="text-muted">{t.none}</p>}
        <ul className="flex flex-col divide-y divide-line">
          {(invitations ?? []).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>{i.email}</span>
              <ActionForm action={revokeEditorInvitation} fields={{ invitationId: i.id }} label={t.revoke} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
