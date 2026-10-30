import { formatShort } from "@/lib/dates";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

/** Abonnements : répartition par offre et derniers foyers (sans donnée personnelle des membres). */
export default async function AdminSubscriptionsPage() {
  await requireAdmin();
  const { subs, households } = await withAdmin(async (db) => {
    const subs = await db
      .selectFrom("subscriptions")
      .select(["household_id", "plan", "status", "trial_ends_at", "current_period_end", "updated_at"])
      .orderBy("updated_at", "desc")
      .limit(200)
      .execute();
    const ids = subs.map((s) => s.household_id);
    const households = ids.length
      ? await db
          .selectFrom("households")
          .select(["id", "name", "association_id"])
          .where("id", "in", ids)
          .execute()
      : [];
    return { subs, households };
  });
  const byId = new Map(households.map((h) => [h.id, h]));
  const counts: Record<string, number> = {};
  for (const s of subs) counts[s.plan] = (counts[s.plan] ?? 0) + 1;
  return (
    <>
      <PageHeader title="Abonnements" />
      <dl className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-4">
        {(["trial", "monthly", "yearly", "free"] as const).map((p) => (
          <Card as="div" padding="cozy" key={p}>
            <dt className="text-sm font-semibold text-muted">
              {{ trial: "Essai", monthly: "Mensuels", yearly: "Annuels", free: "Gratuits" }[p]}
            </dt>
            <dd className="font-display text-3xl font-black">{counts[p] ?? 0}</dd>
          </Card>
        ))}
      </dl>
      <Card as="ul" padding="cozy" className="flex flex-col divide-y divide-line">
        {subs.slice(0, 50).map((s) => (
          <li key={s.household_id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
            <span>
              <b>{byId.get(s.household_id)?.name ?? "?"}</b> · {s.plan} · {s.status}
              {byId.get(s.household_id)?.association_id ? " · association" : ""}
            </span>
            <span className="text-muted">
              {s.plan === "trial" && s.trial_ends_at
                ? `essai jusqu'au ${formatShort(s.trial_ends_at.slice(0, 10))}`
                : s.current_period_end
                  ? `renouvellement ${formatShort(s.current_period_end.slice(0, 10))}`
                  : ""}
            </span>
          </li>
        ))}
      </Card>
    </>
  );
}
