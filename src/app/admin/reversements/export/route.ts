import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { audit, requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { decryptIban, formatIban } from "@/server/iban";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Export CSV d'un trimestre : seul endroit où l'IBAN est déchiffré. L'export est inscrit au journal. */
export async function GET(request: Request) {
  const { user } = await requireAdmin();
  const quarter = new URL(request.url).searchParams.get("quarter") ?? "";
  if (!/^\d{4}-T[1-4]$/.test(quarter)) return new NextResponse(null, { status: 400 });
  const { payouts, assos } = await withAdmin(async (db) => {
    const payouts = await db
      .selectFrom("payouts")
      .select(["association_id", "quarter", "amount_cents", "status"])
      .where("quarter", "=", quarter)
      .execute();
    const ids = payouts.map((p) => p.association_id);
    const assos = ids.length
      ? await db
          .selectFrom("associations")
          .select(["id", "name", "rna_or_siren", "email", "manager_name", "iban_encrypted"])
          .where("id", "in", ids)
          .execute()
      : [];
    return { payouts, assos };
  });
  const byId = new Map(assos.map((a) => [a.id, a]));
  const rows: (string | number)[][] = [
    ["Association", "RNA/SIREN", "Responsable", "E-mail", "Trimestre", "Montant (EUR)", "Statut", "IBAN"],
  ];
  for (const p of payouts) {
    const a = byId.get(p.association_id);
    let iban = "";
    try {
      iban = a?.iban_encrypted ? formatIban(decryptIban(a.iban_encrypted)) : "";
    } catch {
      iban = "ERREUR DE DÉCHIFFREMENT";
    }
    rows.push([
      a?.name ?? "",
      a?.rna_or_siren ?? "",
      a?.manager_name ?? "",
      a?.email ?? "",
      p.quarter,
      (p.amount_cents / 100).toFixed(2).replace(".", ","),
      p.status,
      iban,
    ]);
  }
  await audit(user.id, "payouts.export", quarter, { rows: rows.length - 1 });
  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reversements-${quarter}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
