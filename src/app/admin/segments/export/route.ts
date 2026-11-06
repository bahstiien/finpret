import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { SEGMENT_KEYS } from "@/lib/admin-board";
import { audit, requireAdmin } from "@/server/admin";
import { segmentMembers } from "@/server/admin-board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Export CSV d'un segment au format d'import des contacts Brevo (colonnes EMAIL, PRENOM, OFFRE, INSCRIPTION).
 * L'export est inscrit au journal.
 */
export async function GET(request: Request) {
  const { user } = await requireAdmin();
  const s = new URL(request.url).searchParams.get("s");
  const segment = SEGMENT_KEYS.find((k) => k === s);
  if (!segment) return new NextResponse("Segment inconnu", { status: 404 });
  const members = await segmentMembers(segment);
  const rows: (string | number | null)[][] = [
    ["EMAIL", "PRENOM", "OFFRE", "INSCRIPTION"],
    ...members.map((m) => [m.email, m.name?.split(" ")[0] ?? "", m.plan ?? "", m.created_at.slice(0, 10)]),
  ];
  await audit(user.id, "segment.export", segment, { rows: members.length });
  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="segment-${segment}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
