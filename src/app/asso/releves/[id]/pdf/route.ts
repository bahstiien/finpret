import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSession } from "@/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Relevé PDF d'un trimestre : la RLS (`payouts_select`) limite l'accès au responsable de l'association. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Un identifiant mal formé ferait échouer la requête (uuid) : même réponse qu'un relevé introuvable.
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const payout = await withSession((db) =>
    db.selectFrom("payouts").select(["quarter", "statement_path"]).where("id", "=", id).executeTakeFirst(),
  );
  if (!payout?.statement_path) return new NextResponse(null, { status: 404 });
  const { data: file } = await createAdminClient()
    .storage.from("asso-statements")
    .download(payout.statement_path);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="releve-${payout.quarter}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
