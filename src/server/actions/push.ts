"use server";

import { z } from "zod";
import { fr } from "@/i18n/fr";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/server/errors";
import { deliver, payloadFor } from "@/server/notify";
import { sendWebPush, subscriptionsOf, vapidConfigured } from "@/server/notify-deps";
import { requireUser } from "@/server/session";

/** Abonnement Web Push de l'appareil courant (§12) et notification de test (critère de M9). */

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(sub: unknown, userAgent: string): Promise<ActionResult> {
  const user = await requireUser("/settings/profile");
  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  // Un même navigateur peut changer de compte : l'ancien abonnement de cet appareil est remplacé.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    keys: parsed.data.keys as Json,
    user_agent: userAgent.slice(0, 200),
  });
  return error ? { ok: false, error: fr.errors.generic } : { ok: true, data: undefined };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  await requireUser("/settings/profile");
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true, data: undefined };
}

/** Envoie une notification de test sur tous les appareils abonnés du compte. */
export async function sendTestNotification(): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser("/settings/profile");
  const supabase = await createClient();
  if (!vapidConfigured()) return { ok: false, error: fr.settings.profile.pushNotConfigured };
  const payload = payloadFor("test", null, new Date().toISOString().slice(0, 10));
  const { push } = await deliver(
    {
      subscriptions: (id) => subscriptionsOf(supabase, id),
      sendPush: sendWebPush,
      removeSubscription: async (id) => {
        await supabase.from("push_subscriptions").delete().eq("id", id);
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
