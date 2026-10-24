import { describe, expect, it, vi } from "vitest";
import { cancelHouseholdSubscriptions } from "@/server/subscription-cleanup";
import { createFakeDb } from "./fake-db";

const sub = (id: string | null) => ({ household_id: "h1", stripe_subscription_id: id });

describe("résiliation Stripe avant suppression d'un foyer", () => {
  it("résilie l'abonnement actif", async () => {
    const cancel = vi.fn().mockResolvedValue({});
    const res = await cancelHouseholdSubscriptions(createFakeDb({ subscriptions: [sub("sub_1")] }).db, "h1", {
      subscriptions: { cancel },
    });
    expect(res).toEqual({ ok: true, cancelled: 1 });
    expect(cancel).toHaveBeenCalledWith("sub_1");
  });

  it("ne fait rien sans abonnement Stripe (essai ou gratuit), même sans Stripe configuré", async () => {
    const res = await cancelHouseholdSubscriptions(
      createFakeDb({ subscriptions: [sub(null)] }).db,
      "h1",
      null,
    );
    expect(res).toEqual({ ok: true, cancelled: 0 });
  });

  it("refuse si un abonnement existe mais que Stripe n'est pas configuré", async () => {
    const res = await cancelHouseholdSubscriptions(
      createFakeDb({ subscriptions: [sub("sub_1")] }).db,
      "h1",
      null,
    );
    expect(res).toEqual({ ok: false, reason: "not_configured" });
  });

  it("considère un abonnement déjà supprimé chez Stripe comme résilié", async () => {
    const cancel = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("absent"), { code: "resource_missing" }));
    const res = await cancelHouseholdSubscriptions(createFakeDb({ subscriptions: [sub("sub_1")] }).db, "h1", {
      subscriptions: { cancel },
    });
    expect(res).toEqual({ ok: true, cancelled: 0 });
  });

  it("interrompt sur toute autre erreur Stripe", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cancel = vi.fn().mockRejectedValue(new Error("réseau"));
    const res = await cancelHouseholdSubscriptions(createFakeDb({ subscriptions: [sub("sub_1")] }).db, "h1", {
      subscriptions: { cancel },
    });
    expect(res).toEqual({ ok: false, reason: "stripe" });
  });
});
