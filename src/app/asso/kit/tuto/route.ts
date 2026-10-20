import { NextResponse } from "next/server";
import { getMyAssociation } from "@/server/asso-session";
import { tutoPdfFor } from "@/server/kit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Téléchargement de la fiche tuto (PDF, 2 pages) de l'association du compte, une fois validée. */
export async function GET(request: Request) {
  const association = await getMyAssociation();
  if (!association || association.status !== "approved") return new NextResponse(null, { status: 404 });
  const pdf = await tutoPdfFor(association.id, new URL(request.url).origin);
  if (!pdf) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="fiche-tuto-${association.code}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
