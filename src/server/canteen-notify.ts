import "server-only";
import { isoWeekKey, mondayOf } from "@/lib/dates";
import { notificationsSchema } from "@/lib/settings";
import { fr } from "@/i18n/fr";
import { withAdmin } from "@/server/db";
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
  const weeks = [...new Set(dates.map(mondayOf))];
  let users = 0;
  let sentWeeks = 0;
  for (const monday of weeks) {
    const week = isoWeekKey(monday);
    try {
      await withAdmin((db) =>
        db.insertInto("canteen_notifications").values({ school_id: schoolId, iso_week: week }).execute(),
      );
    } catch {
      continue; // déjà notifiée pour cette école et cette semaine
    }
    sentWeeks++;
    const settings = await withAdmin(async (db) => {
      const links = await db
        .selectFrom("member_schools")
        .select("member_id")
        .where("school_id", "=", schoolId)
        .execute();
      const memberIds = links.map((l) => l.member_id);
      if (!memberIds.length) return [];
      const members = await db
        .selectFrom("members")
        .select("household_id")
        .where("id", "in", memberIds)
        .execute();
      const households = [...new Set(members.map((m) => m.household_id))];
      if (!households.length) return [];
      const memberships = await db
        .selectFrom("memberships")
        .select("user_id")
        .where("household_id", "in", households)
        .execute();
      const userIds = [...new Set(memberships.map((m) => m.user_id))];
      if (!userIds.length) return [];
      return db
        .selectFrom("user_settings")
        .select(["user_id", "notifications"])
        .where("user_id", "in", userIds)
        .execute();
    });
    for (const s of settings) {
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
