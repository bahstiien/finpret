import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { closeDueWeeks } from "@/server/progress";
import { createProgressStore } from "@/server/progress-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Clôture des semaines fin prêtes (SPEC_PROGRES §3.4), toutes les heures : `Authorization: Bearer <CRON_SECRET>`.
 * Idempotente (une ligne `streak_weeks` existante n'est jamais écrasée). `?at=` (date ISO) rejoue un passage.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok =
    !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const at = request.nextUrl.searchParams.get("at");
  const now = at ? new Date(at) : new Date();
  if (Number.isNaN(now.getTime())) return NextResponse.json({ error: "at" }, { status: 400 });
  return NextResponse.json(await closeDueWeeks(createProgressStore(), now));
}

export const POST = GET;
