import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { runNotifications } from "@/server/notify";
import { createNotifyDeps } from "@/server/notify-deps";
import { runTrialEnding } from "@/server/trial-ending";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Planificateur (toutes les 15 min) : `Authorization: Bearer <CRON_SECRET>` (§12). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok =
    !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // `?at=` (date ISO) rejoue un passage à une heure donnée : rattrapage après une panne, tests.
  const at = request.nextUrl.searchParams.get("at");
  const now = at ? new Date(at) : new Date();
  if (Number.isNaN(now.getTime())) return NextResponse.json({ error: "at" }, { status: 400 });
  const summary = await runNotifications(createNotifyDeps(request.nextUrl.origin), now);
  const trial = await runTrialEnding(request.nextUrl.origin, now);
  return NextResponse.json({ ...summary, trialEnding: trial });
}

export const POST = GET;
