import { sql } from "kysely";
import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { audit, requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Export CSV de tous les abonnements. L'export est inscrit au journal. */
export async function GET() {
  const { user } = await requireAdmin();
  const subs = await withAdmin((db) =>
    db
      .selectFrom("subscriptions as s")
      .innerJoin("households as h", "h.id", "s.household_id")
      .select([
        "h.name",
        "s.plan",
        "s.status",
        "s.trial_ends_at",
        "s.current_period_end",
        "s.stripe_customer_id",
        "s.updated_at",
        sql<string | null>`(select u.email from memberships m join auth.users u on u.id = m.user_id
          where m.household_id = s.household_id and m.role = 'admin' order by m.created_at limit 1)`.as("owner_email"),
      ])
      .orderBy("s.updated_at", "desc")
      .execute(),
  );
  const rows: (string | null)[][] = [
    ["Foyer", "E-mail", "Offre", "Statut", "Fin d'essai", "Renouvellement", "Client Stripe", "Mis à jour"],
    ...subs.map((s) => [
      s.name,
      s.owner_email,
      s.plan,
      s.status,
      s.trial_ends_at?.slice(0, 10) ?? "",
      s.current_period_end?.slice(0, 10) ?? "",
      s.stripe_customer_id,
      s.updated_at.slice(0, 10),
    ]),
  ];
  await audit(user.id, "subscriptions.export", null, { rows: subs.length });
  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="abonnements.csv"',
      "cache-control": "private, no-store",
    },
  });
}
