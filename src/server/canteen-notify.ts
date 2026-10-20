import "server-only";
import { isoWeekKey, mondayOf } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationsSchema } from "@/lib/settings";
import { fr } from "@/i18n/fr";
import { deliver, type NotifyDeps, type Payload } from "@/server/notify";
import { createNotifyDeps } from "@/server/notify-deps";

/**
 * Notification « menus publiés » (SPEC_JANVIER §5, §8) : au plus une par école et par semaine ISO, aux familles
 * qui ont un enfant relié à l'école. Réservation par `canteen_notifications` (école, semaine) puis par
 * `notification_log` (compte, type, jour = lundi de la semaine). `deps` est injectable pour les tests.
 */
export async function notifyCanteenPublished(
  schoolId: string,
  dates: string[],
  baseUrl: string,
  deps: NotifyDeps = createNotifyDeps(baseUrl),
): Promise<{ weeks: number; users: number }> {
  const db = createAdminClient();
  const weeks = [...new Set(dates.map(mondayOf))];
  let users = 0;
  let sentWeeks = 0;
  for (const monday of weeks) {
    const week = isoWeekKey(monday);
    const { error } = await db.from("canteen_notifications").insert({ school_id: schoolId, iso_week: week });
    if (error) continue; // déjà notifiée pour cette école et cette semaine
    sentWeeks++;
    const { data: links } = await db.from("member_schools").select("member_id").eq("school_id", schoolId);
    const memberIds = (links ?? []).map((l) => l.member_id);
    if (!memberIds.length) continue;
    const { data: members } = await db.from("members").select("household_id").in("id", memberIds);
    const households = [...new Set((members ?? []).map((m) => m.household_id))];
    if (!households.length) continue;
    const { data: memberships } = await db
      .from("memberships")
      .select("user_id")
      .in("household_id", households);
    const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];
    const { data: settings } = await db
      .from("user_settings")
      .select("user_id, notifications")
      .in("user_id", userIds);
    for (const s of settings ?? []) {
      const prefs = notificationsSchema.safeParse(s.notifications ?? {});
      if (!prefs.success || !prefs.data.consentAt || !(prefs.data.push || prefs.data.email)) continue;
      const payload: Payload = {
        kind: "canteen_published",
        title: fr.subscription.canteenPublished.title,
        body: fr.subscription.canteenPublished.body,
        url: "/app",
        day: monday,
      };
      if (!(await deps.claim(s.user_id, "canteen_published", monday, payload))) continue;
      await deliver(deps, s.user_id, prefs.data, payload);
      users++;
    }
  }
  return { weeks: sentWeeks, users };
}
