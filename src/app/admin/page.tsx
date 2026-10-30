import { sql } from "kysely";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

/** Accueil du back-office : quelques compteurs. */
export default async function AdminHome() {
  await requireAdmin();
  const [pending, households, leads, ready] = await withAdmin(async (db) => {
    const count = async (
      table: "associations" | "households" | "association_leads" | "payouts",
      status?: "pending" | "ready",
    ) => {
      let q = db.selectFrom(table).select(sql<number>`count(*)`.as("n"));
      if (status) q = q.where(sql.ref("status"), "=", status);
      return Number((await q.executeTakeFirst())?.n ?? 0);
    };
    return [
      await count("associations", "pending"),
      await count("households"),
      await count("association_leads"),
      await count("payouts", "ready"),
    ];
  });
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
