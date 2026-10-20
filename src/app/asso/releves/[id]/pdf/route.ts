import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Relevé PDF d'un trimestre : la RLS (`payouts_select`) limite l'accès au responsable de l'association. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: payout } = await supabase
    .from("payouts")
    .select("quarter, statement_path")
    .eq("id", id)
    .maybeSingle();
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
