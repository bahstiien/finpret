import type { Db } from "@/server/db";

/** Partie de l'API Stripe utilisée ici (injectable dans les tests). */
export type SubscriptionCanceller = {
  subscriptions: { cancel(id: string): Promise<unknown> };
};

export type CancelResult =
  { ok: true; cancelled: number } | { ok: false; reason: "not_configured" | "stripe" };

/**
 * Résilie tout de suite les abonnements Stripe d'un foyer qui va être supprimé : sans cela, la ligne
 * `subscriptions` disparaît en cascade mais Stripe continue de facturer. Un abonnement déjà supprimé côté Stripe
 * (`resource_missing`) est considéré comme résilié. Toute autre erreur interrompt la suppression : mieux vaut un
 * compte conservé qu'un client facturé sans compte. Le client Stripe et les factures sont conservés (comptabilité).
 * `db` doit voir les abonnements du foyer (`withAdmin` côté serveur).
 */
export async function cancelHouseholdSubscriptions(
  db: Db,
  householdId: string,
  stripe: SubscriptionCanceller | null,
): Promise<CancelResult> {
  const rows = await db
    .selectFrom("subscriptions")
    .select("stripe_subscription_id")
    .where("household_id", "=", householdId)
    .execute();
  const ids = rows.map((r) => r.stripe_subscription_id).filter((id): id is string => !!id);
  if (ids.length === 0) return { ok: true, cancelled: 0 };
  if (!stripe) return { ok: false, reason: "not_configured" };
  let cancelled = 0;
  for (const id of ids) {
    try {
      await stripe.subscriptions.cancel(id);
      cancelled += 1;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "resource_missing") continue;
      console.error("Stripe résiliation avant suppression :", e instanceof Error ? e.message : e);
      return { ok: false, reason: "stripe" };
    }
  }
  return { ok: true, cancelled };
}
