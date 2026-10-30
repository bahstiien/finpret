"use server";

import { z } from "zod";
import { fr } from "@/i18n/fr";
import { json } from "@/server/db";
import type { ActionResult } from "@/server/errors";
import { deliver, payloadFor } from "@/server/notify";
import { sendWebPush, subscriptionsOf, vapidConfigured } from "@/server/notify-deps";
import { requireUser, withSession } from "@/server/session";

/** Abonnement Web Push de l'appareil courant (§12) et notification de test (critère de M9). */

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(sub: unknown, userAgent: string): Promise<ActionResult> {
  const user = await requireUser("/settings/profile");
  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  try {
    await withSession(async (db) => {
      // Un même navigateur peut changer de compte : l'ancien abonnement de cet appareil est remplacé.
      await db.deleteFrom("push_subscriptions").where("endpoint", "=", parsed.data.endpoint).execute();
      await db
        .insertInto("push_subscriptions")
        .values({
          user_id: user.id,
          endpoint: parsed.data.endpoint,
          keys: json(parsed.data.keys),
          user_agent: userAgent.slice(0, 200),
        })
        .execute();
    });
  } catch {
    return { ok: false, error: fr.errors.generic };
  }
  return { ok: true, data: undefined };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  await requireUser("/settings/profile");
  await withSession((db) => db.deleteFrom("push_subscriptions").where("endpoint", "=", endpoint).execute());
  return { ok: true, data: undefined };
}

/** Envoie une notification de test sur tous les appareils abonnés du compte. */
export async function sendTestNotification(): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser("/settings/profile");
  if (!vapidConfigured()) return { ok: false, error: fr.settings.profile.pushNotConfigured };
  const payload = payloadFor("test", null, new Date().toISOString().slice(0, 10));
  const { push } = await deliver(
    {
      subscriptions: (id) => withSession((db) => subscriptionsOf(db, id)),
      sendPush: sendWebPush,
      removeSubscription: async (id) => {
        await withSession((db) => db.deleteFrom("push_subscriptions").where("id", "=", id).execute());
      },
      // Pas d'e-mail pour un test.
      emailOf: async () => null,
      sendEmail: async () => false,
      recipients: async () => [],
      content: async () => null,
      claim: async () => true,
    },
    user.id,
    { push: true, email: false },
    payload,
  );
  return { ok: true, data: { message: fr.settings.profile.testSent(push) } };
}
