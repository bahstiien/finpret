import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { formatShort } from "@/lib/dates";
import { extendTrial } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";

/** Support : retrouver un compte par e-mail, voir ses foyers et son offre, prolonger un essai. */
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db } = await requireAdmin();
  const { q } = await searchParams;
  const email = q?.trim().toLowerCase() ?? "";
  let found: { id: string; email: string } | null = null;
  if (email) {
    // Liste paginée de l'API d'administration : suffisant à l'échelle du lancement (quelques centaines de comptes).
    for (let page = 1; page <= 20 && !found; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
      const u = data.users.find((x) => x.email?.toLowerCase() === email);
      if (u) found = { id: u.id, email: u.email ?? "" };
      if (data.users.length < 200) break;
    }
  }
  const { data: memberships } = found
    ? await db.from("memberships").select("household_id, role").eq("user_id", found.id)
    : { data: [] };
  const ids = (memberships ?? []).map((m) => m.household_id);
  const [{ data: households }, { data: subs }] = ids.length
    ? await Promise.all([
        db.from("households").select("id, name, association_id, created_at").in("id", ids),
        db.from("subscriptions").select("household_id, plan, status, trial_ends_at").in("household_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  return (
    <>
      <PageHeader title="Support" />
      <form className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4">
        <TextField
          id="q"
          name="q"
          type="email"
          label="E-mail du compte"
          defaultValue={q ?? ""}
          className="min-w-64 flex-1"
        />
        <Button type="submit">Chercher</Button>
      </form>
      {q && !found && <p className="text-muted">Aucun compte avec cet e-mail.</p>}
      {found && (
        <Card padding="cozy" className="flex flex-col gap-3">
          <p>
            <b>{found.email}</b> · <code className="text-xs">{found.id}</code>
          </p>
          {(households ?? []).map((h) => {
            const s = (subs ?? []).find((x) => x.household_id === h.id);
            return (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"
              >
                <span>
                  <b>{h.name}</b> · {s?.plan ?? "?"} / {s?.status ?? "?"}
                  {s?.trial_ends_at ? ` · essai jusqu'au ${formatShort(s.trial_ends_at.slice(0, 10))}` : ""}
                  {h.association_id ? " · rattaché à une association" : ""}
                </span>
                {s && (s.plan === "trial" || s.plan === "free") && (
                  <ActionForm
                    action={extendTrial}
                    fields={{ householdId: h.id }}
                    label="Prolonger l'essai de 14 jours"
                  />
                )}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
