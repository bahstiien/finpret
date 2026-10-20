import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { runQuarterClosing } from "@/server/closing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Clôture trimestrielle des reversements : `Authorization: Bearer <CRON_SECRET>`, planifiée les 1er janvier, avril,
 * juillet et octobre à 03:00 (Europe/Paris). `?quarter=2027-T1` rejoue un trimestre précis.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok =
    !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const quarter = request.nextUrl.searchParams.get("quarter") ?? undefined;
  if (quarter && !/^\d{4}-T[1-4]$/.test(quarter))
    return NextResponse.json({ error: "quarter" }, { status: 400 });
  return NextResponse.json(await runQuarterClosing(quarter));
}

export const POST = GET;
