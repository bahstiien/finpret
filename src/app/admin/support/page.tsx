import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { formatShort } from "@/lib/dates";
import { extendTrial } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { findUserByEmail } from "@/server/users";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";

/** Support : retrouver un compte par e-mail, voir ses foyers et son offre, prolonger un essai. */
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const email = q?.trim().toLowerCase() ?? "";
  let found: { id: string; email: string } | null = null;
  if (email) found = await findUserByEmail(email);
  const userId = found?.id;
  const { households, subs } = userId
    ? await withAdmin(async (db) => {
        const memberships = await db
          .selectFrom("memberships")
          .select(["household_id", "role"])
          .where("user_id", "=", userId)
          .execute();
        const ids = memberships.map((m) => m.household_id);
        if (!ids.length) return { households: [], subs: [] };
        return {
          households: await db
            .selectFrom("households")
            .select(["id", "name", "association_id", "created_at"])
            .where("id", "in", ids)
            .execute(),
          subs: await db
            .selectFrom("subscriptions")
            .select(["household_id", "plan", "status", "trial_ends_at"])
            .where("household_id", "in", ids)
            .execute(),
        };
      })
    : { households: [], subs: [] };
  return (
    <>
      <PageHeader title="Support" />
      <form className="card flex flex-wrap items-end gap-3 !shadow-none">
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
      {q && !found && <p className="muted">Aucun compte avec cet e-mail.</p>}
      {found && (
        <Card className="flex flex-col gap-3 !shadow-none">
          <p>
            <b>{found.email}</b> · <code className="mono t-small">{found.id}</code>
          </p>
          {households.map((h) => {
            const s = subs.find((x) => x.household_id === h.id);
            return (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t-[length:var(--bw)] border-line pt-3"
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
