import "server-only";
import { autoPausedNoticeDue, localTime } from "@/engine/notifications";
import { fr } from "@/i18n/fr";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationsSchema } from "@/lib/settings";
import { deliver, type Payload } from "@/server/notify";
import { createNotifyDeps } from "@/server/notify-deps";

/**
 * Information « série en pause » (SPEC_PROGRES §3.7) : le jeudi à partir de 9 h locales, aux membres d'un foyer dont la
 * semaine qui vient de se clore a consommé une pause automatique. Web Push, avec repli e-mail selon les réglages ;
 * désactivable (`streakPaused`). Idempotent par (compte, type, lundi de la semaine) grâce à `claim_notification`.
 */
export async function runStreakPausedNotifications(
  baseUrl: string,
  now = new Date(),
): Promise<{ due: number; sent: number }> {
  const db = createAdminClient();
  const deps = createNotifyDeps(baseUrl);
  const summary = { due: 0, sent: 0 };

  // Les lundis candidats : le jeudi local est partout dans les 4 derniers jours, la semaine est celle d'il y a 3 jours.
  const { data: rows } = await db
    .from("streak_weeks")
    .select("household_id, week_start")
    .eq("outcome", "paused")
    .eq("source", "auto")
    .gte("week_start", new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10));
  if (!rows?.length) return summary;
  const { data: households } = await db
    .from("households")
    .select("id, timezone")
    .in("id", [...new Set(rows.map((r) => r.household_id))]);
  const zone = new Map((households ?? []).map((h) => [h.id, h.timezone]));

  for (const row of rows) {
    const local = localTime(now, zone.get(row.household_id) ?? "Europe/Paris");
    if (!autoPausedNoticeDue(row.week_start, local)) continue;
    const { data: members } = await db.from("memberships").select("user_id").eq("household_id", row.household_id);
    for (const { user_id: userId } of members ?? []) {
      const { data: settings } = await db.from("user_settings").select("notifications").eq("user_id", userId).maybeSingle();
      const prefs = notificationsSchema.safeParse(settings?.notifications ?? {});
      if (!prefs.success || !prefs.data.consentAt || !prefs.data.streakPaused || !prefs.data.progress_visible) continue;
      if (!(prefs.data.push || prefs.data.email)) continue;
      summary.due++;
      const payload: Payload = {
        kind: "streak_paused",
        title: fr.app.name,
        body: fr.progress.streak.autoPausedPush,
        url: "/app/progress",
        day: row.week_start,
      };
      if (!(await deps.claim(userId, "streak_paused", row.week_start, payload))) continue;
      await deliver(deps, userId, prefs.data, payload);
      summary.sent++;
    }
  }
  return summary;
}
