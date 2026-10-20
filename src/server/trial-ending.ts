import "server-only";
import { trialReminderDue } from "@/engine/trial";
import { fr } from "@/i18n/fr";
import { notificationsSchema } from "@/lib/settings";
import { todayIn } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTrialEnding } from "@/server/emails";
import { deliver, type Payload } from "@/server/notify";
import { createNotifyDeps } from "@/server/notify-deps";

/**
 * Fin d'essai (SPEC_JANVIER §8) : à J-3 et J0, 10 h heure du foyer, aux administrateurs du foyer, par Web Push (si
 * consenti) et par e-mail (sauf désinscription). Idempotent par (compte, type, jour) grâce à `claim_notification`.
 * Appelé par le planificateur toutes les 15 minutes, comme les autres rappels.
 */
export async function runTrialEnding(
  baseUrl: string,
  now = new Date(),
): Promise<{ due: number; sent: number }> {
  const db = createAdminClient();
  const deps = createNotifyDeps(baseUrl);
  const summary = { due: 0, sent: 0 };

  const { data: subs } = await db
    .from("subscriptions")
    .select("household_id, trial_ends_at")
    .eq("plan", "trial")
    .not("trial_ends_at", "is", null);
  if (!subs?.length) return summary;
  const { data: households } = await db
    .from("households")
    .select("id, timezone")
    .in(
      "id",
      subs.map((s) => s.household_id),
    );
  const zone = new Map((households ?? []).map((h) => [h.id, h.timezone]));

  for (const sub of subs) {
    const tz = zone.get(sub.household_id) ?? "Europe/Paris";
    const days = sub.trial_ends_at ? trialReminderDue(sub.trial_ends_at, tz, now) : null;
    if (days === null) continue;
    const day = todayIn(tz, now);
    const { data: admins } = await db
      .from("memberships")
      .select("user_id")
      .eq("household_id", sub.household_id)
      .eq("role", "admin");
    for (const { user_id: userId } of admins ?? []) {
      summary.due++;
      const payload: Payload = {
        kind: "trial_ending",
        title: fr.subscription.trialEnding.title,
        body: fr.subscription.trialEnding.body(days),
        url: "/app/abonnement",
        day,
      };
      if (!(await deps.claim(userId, "trial_ending", day, payload))) continue;
      const { data: settings } = await db
        .from("user_settings")
        .select("notifications")
        .eq("user_id", userId)
        .maybeSingle();
      const prefs = notificationsSchema.parse(settings?.notifications ?? {});
      if (prefs.consentAt && prefs.push) await deliver(deps, userId, { push: true, email: false }, payload);
      if (prefs.marketingEmails) {
        const email = await deps.emailOf(userId);
        if (email) await sendTrialEnding(email, userId, days);
      }
      summary.sent++;
    }
  }
  return summary;
}
