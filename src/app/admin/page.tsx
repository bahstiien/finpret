import { requireAdmin } from "@/server/admin";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

/** Accueil du back-office : quelques compteurs. */
export default async function AdminHome() {
  const { db } = await requireAdmin();
  const count = async (
    table: "associations" | "households" | "association_leads" | "payouts",
    col?: [string, string],
  ) => {
    let q = db.from(table).select("*", { count: "exact", head: true });
    if (col) q = q.eq(col[0] as never, col[1] as never);
    return (await q).count ?? 0;
  };
  const [pending, households, leads, ready] = await Promise.all([
    count("associations", ["status", "pending"]),
    count("households"),
    count("association_leads"),
    count("payouts", ["status", "ready"]),
  ]);
  const cards = [
    ["Associations à valider", pending],
    ["Foyers", households],
    ["Demandes de présentation", leads],
    ["Versements à effectuer", ready],
  ] as const;
  return (
    <>
      <PageHeader title="Back-office" />
      <dl className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-4">
        {cards.map(([label, n]) => (
          <Card as="div" padding="cozy" key={label}>
            <dt className="text-sm font-semibold text-muted">{label}</dt>
            <dd className="font-display text-3xl font-black">{n}</dd>
          </Card>
        ))}
      </dl>
    </>
  );
}
