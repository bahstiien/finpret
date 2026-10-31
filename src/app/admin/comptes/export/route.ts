import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { audit, requireAdmin } from "@/server/admin";
import { listAccounts } from "@/server/crm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Export CSV des comptes (mêmes filtres que la liste, sans pagination). L'export est inscrit au journal. */
export async function GET(request: Request) {
  const { user } = await requireAdmin();
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const plan = sp.get("plan") ?? "";
  const rows: (string | number | null)[][] = [
    ["E-mail", "Nom", "Inscription", "E-mail vérifié", "Dernière activité", "Foyers", "Offre", "Statut"],
  ];
  for (let page = 1; page <= 200; page++) {
    const { rows: chunk, total } = await listAccounts({ q: q || undefined, plan: plan || undefined, page });
    for (const a of chunk)
      rows.push([a.email, a.name, a.created_at.slice(0, 10), a.email_verified ? "oui" : "non", a.last_seen?.slice(0, 10) ?? "", a.households, a.plan, a.status]);
    if (page * 50 >= total) break;
  }
  await audit(user.id, "accounts.export", null, { rows: rows.length - 1 });
  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="comptes.csv"',
      "cache-control": "private, no-store",
    },
  });
}
