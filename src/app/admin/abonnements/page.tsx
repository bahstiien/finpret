import Link from "next/link";
import { sql } from "kysely";
import { formatShort } from "@/lib/dates";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const PLAN_LABEL: Record<string, string> = { trial: "Essai", monthly: "Mensuel", yearly: "Annuel", free: "Gratuit" };
const STATUSES = ["", "trialing", "active", "past_due", "canceled"] as const;

/** Suivi des abonnements : répartition (tous foyers), alertes d'impayé, essais qui se terminent, liste filtrable. */
export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "";
  const { byPlan, byStatus, subs, endingSoon } = await withAdmin(async (db) => {
    const byPlan = await db
      .selectFrom("subscriptions")
      .select(["plan", sql<number>`count(*)`.as("n")])
      .groupBy("plan")
      .execute();
    const byStatus = await db
      .selectFrom("subscriptions")
      .select(["status", sql<number>`count(*)`.as("n")])
      .groupBy("status")
      .execute();
    let q = db
      .selectFrom("subscriptions as s")
      .innerJoin("households as h", "h.id", "s.household_id")
      .select([
        "s.household_id",
        "h.name",
        "h.association_id",
        "s.plan",
        "s.status",
        "s.trial_ends_at",
        "s.current_period_end",
        "s.updated_at",
        sql<string | null>`(select u.email from memberships m join auth.users u on u.id = m.user_id
          where m.household_id = s.household_id and m.role = 'admin' order by m.created_at limit 1)`.as("owner_email"),
        sql<string | null>`(select m.user_id from memberships m
          where m.household_id = s.household_id and m.role = 'admin' order by m.created_at limit 1)`.as("owner_id"),
      ])
      .orderBy("s.updated_at", "desc")
      .limit(100);
    if (status) q = q.where("s.status", "=", status);
    const subs = await q.execute();
    const endingSoon = Number(
      (
        await db
          .selectFrom("subscriptions")
          .select(sql<number>`count(*)`.as("n"))
          .where("plan", "=", "trial")
          .where(sql<boolean>`trial_ends_at between now() and now() + interval '7 days'`)
          .executeTakeFirst()
      )?.n ?? 0,
    );
    return { byPlan, byStatus, subs, endingSoon };
  });
  const plan = (p: string) => Number(byPlan.find((r) => r.plan === p)?.n ?? 0);
  const st = (s: string) => Number(byStatus.find((r) => r.status === s)?.n ?? 0);
  return (
    <>
      <PageHeader
        title="Abonnements"
        actions={
          <a href="/admin/abonnements/export" className="btn btn--outline">
            Exporter en CSV
          </a>
        }
      />
      <dl className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-4">
        {(["trial", "monthly", "yearly", "free"] as const).map((p) => (
          <Card as="div" key={p}>
            <dt className="t-label">{PLAN_LABEL[p]}</dt>
            <dd className="num-l">{plan(p)}</dd>
          </Card>
        ))}
        <Card as="div" tone={st("past_due") ? "pink" : "surface"}>
          <dt className="t-label">Paiements en échec</dt>
          <dd className="num-l">{st("past_due")}</dd>
        </Card>
        <Card as="div">
          <dt className="t-label">Essais finissant sous 7 j</dt>
          <dd className="num-l">{endingSoon}</dd>
        </Card>
        <Card as="div">
          <dt className="t-label">Résiliés</dt>
          <dd className="num-l">{st("canceled")}</dd>
        </Card>
      </dl>
      <nav aria-label="Filtre par statut" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s ? `/admin/abonnements?status=${s}` : "/admin/abonnements"}
            className={`btn btn--sm ${s === status ? "" : "btn--outline"}`}
          >
            {s || "tous"}
          </Link>
        ))}
      </nav>
      <Card as="ul" className="!shadow-none">
        {subs.map((s) => (
          <li key={s.household_id} className="row t-small flex-wrap justify-between gap-2">
            <span>
              <b>{s.name}</b>
              {s.owner_email && s.owner_id && (
                <>
                  {" · "}
                  <Link href={`/admin/comptes/${s.owner_id}`} className="underline">
                    {s.owner_email}
                  </Link>
                </>
              )}
              {s.association_id ? " · association" : ""}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone={s.status === "past_due" ? "pink" : s.plan === "trial" ? "yellow" : "green"}>
                {PLAN_LABEL[s.plan] ?? s.plan} · {s.status}
              </Pill>
              <span className="mono muted">
                {s.plan === "trial" && s.trial_ends_at
                  ? `essai jusqu'au ${formatShort(s.trial_ends_at.slice(0, 10))}`
                  : s.current_period_end
                    ? `renouvellement ${formatShort(s.current_period_end.slice(0, 10))}`
                    : ""}
              </span>
            </span>
          </li>
        ))}
        {!subs.length && <li className="muted">Aucun abonnement.</li>}
      </Card>
    </>
  );
}
