import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelHouseholdSubscriptions } from "@/server/subscription-cleanup";
import { createTestDb, type TestDb } from "./pglite-db";

const H = "00000000-0000-4000-8000-0000000000a1";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

/** Foyer de test ; la création du foyer ouvre déjà sa ligne `subscriptions` (essai). */
async function householdWith(stripeSubscriptionId: string | null) {
  await db.admin(async (tx) => {
    await tx.deleteFrom("households").execute();
    await tx.insertInto("households").values({ id: H, name: "Foyer test" }).execute();
    await tx
      .updateTable("subscriptions")
      .set({ stripe_subscription_id: stripeSubscriptionId })
      .where("household_id", "=", H)
      .execute();
  });
}

const cancelFor = (stripe: Parameters<typeof cancelHouseholdSubscriptions>[2]) =>
  db.admin((tx) => cancelHouseholdSubscriptions(tx, H, stripe));

describe("résiliation Stripe avant suppression d'un foyer", () => {
  beforeEach(() => householdWith(null));

  it("résilie l'abonnement actif", async () => {
    await householdWith("sub_1");
    const cancel = vi.fn().mockResolvedValue({});
    expect(await cancelFor({ subscriptions: { cancel } })).toEqual({ ok: true, cancelled: 1 });
    expect(cancel).toHaveBeenCalledWith("sub_1");
  });

  it("ne fait rien sans abonnement Stripe (essai ou gratuit), même sans Stripe configuré", async () => {
    expect(await cancelFor(null)).toEqual({ ok: true, cancelled: 0 });
  });

  it("refuse si un abonnement existe mais que Stripe n'est pas configuré", async () => {
    await householdWith("sub_1");
    expect(await cancelFor(null)).toEqual({ ok: false, reason: "not_configured" });
  });

  it("considère un abonnement déjà supprimé chez Stripe comme résilié", async () => {
    await householdWith("sub_1");
    const cancel = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("absent"), { code: "resource_missing" }));
    expect(await cancelFor({ subscriptions: { cancel } })).toEqual({ ok: true, cancelled: 0 });
  });

  it("interrompt sur toute autre erreur Stripe", async () => {
    await householdWith("sub_1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cancel = vi.fn().mockRejectedValue(new Error("réseau"));
    expect(await cancelFor({ subscriptions: { cancel } })).toEqual({ ok: false, reason: "stripe" });
  });
});
