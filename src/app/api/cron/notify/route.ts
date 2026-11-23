import { type NextRequest, NextResponse } from "next/server";
import { isCronRequest } from "@/server/cron-auth";
import { runGettingStartedMessages } from "@/server/getting-started-messages";
import { runNotifications } from "@/server/notify";
import { createNotifyDeps } from "@/server/notify-deps";
import { runStreakPausedNotifications } from "@/server/streak-notify";
import { runRenewalNotices } from "@/server/renewal-notice";
import { runTrialEnding } from "@/server/trial-ending";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Planificateur (toutes les 15 min) : `Authorization: Bearer <CRON_SECRET>` (§12). */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // `?at=` (date ISO) rejoue un passage à une heure donnée : rattrapage après une panne, tests.
  const at = request.nextUrl.searchParams.get("at");
  const now = at ? new Date(at) : new Date();
  if (Number.isNaN(now.getTime())) return NextResponse.json({ error: "at" }, { status: 400 });
  // Adresse publique des liens des e-mails : deploy/cron.sh appelle http://127.0.0.1:3000, jamais l'adresse du site.
  const base = process.env.APP_URL ?? request.nextUrl.origin;
  const summary = await runNotifications(createNotifyDeps(base), now);
  const trial = await runTrialEnding(base, now);
  const streakPaused = await runStreakPausedNotifications(base, now);
  const renewal = await runRenewalNotices(base, now);
  const gettingStarted = await runGettingStartedMessages(base, now);
  return NextResponse.json({ ...summary, trialEnding: trial, streakPaused, renewalNotice: renewal, gettingStarted });
}

export const POST = GET;
