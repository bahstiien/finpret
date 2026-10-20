import { formatShort } from "@/lib/dates";
import { requireAdmin } from "@/server/admin";
import { PageHeader } from "@/components/ui/Layout";

/** Abonnements : répartition par offre et derniers foyers (sans donnée personnelle des membres). */
export default async function AdminSubscriptionsPage() {
  const { db } = await requireAdmin();
  const { data: subs } = await db
    .from("subscriptions")
    .select("household_id, plan, status, trial_ends_at, current_period_end, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  const ids = (subs ?? []).map((s) => s.household_id);
  const { data: households } = ids.length
    ? await db.from("households").select("id, name, association_id").in("id", ids)
    : { data: [] };
  const byId = new Map((households ?? []).map((h) => [h.id, h]));
  const counts: Record<string, number> = {};
  for (const s of subs ?? []) counts[s.plan] = (counts[s.plan] ?? 0) + 1;
  return (
    <>
      <PageHeader title="Abonnements" />
      <dl className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-4">
        {(["trial", "monthly", "yearly", "free"] as const).map((p) => (
          <div key={p} className="rounded-card bg-surface p-5">
            <dt className="text-sm font-semibold text-muted">
              {{ trial: "Essai", monthly: "Mensuels", yearly: "Annuels", free: "Gratuits" }[p]}
            </dt>
            <dd className="font-display text-3xl font-black">{counts[p] ?? 0}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-col divide-y divide-line rounded-card bg-surface p-5">
        {(subs ?? []).slice(0, 50).map((s) => (
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
      </ul>
    </>
  );
}
