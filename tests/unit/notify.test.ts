import { describe, expect, it } from "vitest";
import type { NotificationPrefs } from "@/engine/notifications";
import { type NotifyDeps, type Payload, runNotifications } from "@/server/notify";

const PREFS: NotificationPrefs = {
  push: true,
  email: false,
  dinner: { enabled: true, time: "17:30" },
  thaw: { enabled: true, time: "20:30" },
  shoppingReady: true,
  sessionStart: true,
  consentAt: "2026-10-01T10:00:00Z",
};

function fakeDeps(overrides: Partial<NotifyDeps> = {}) {
  const log = new Set<string>();
  const pushes: { endpoint: string; payload: Payload }[] = [];
  const emails: { to: string; payload: Payload }[] = [];
  const removed: string[] = [];
  const deps: NotifyDeps = {
    recipients: async () => [
      {
        userId: "u1",
        householdId: "h1",
        timezone: "Europe/Paris",
        prefs: PREFS,
        schedule: { sessionDay: 0, sessionTime: "14:00", shoppingDay: 6 },
      },
    ],
    content: async (_h, kind) => (kind === "dinner" ? "réchauffe le chili 3 min au micro-ondes" : null),
    claim: async (userId, kind, day) => {
      const key = `${userId}:${kind}:${day}`;
      if (log.has(key)) return false;
      log.add(key);
      return true;
    },
    subscriptions: async () => [
      { id: "s1", endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } },
      { id: "s2", endpoint: "https://push.example/2", keys: { p256dh: "p", auth: "a" } },
    ],
    sendPush: async (sub, payload) => {
      pushes.push({ endpoint: sub.endpoint, payload });
      return "ok";
    },
    removeSubscription: async (id) => {
      removed.push(id);
    },
    emailOf: async () => "camille@example.com",
    sendEmail: async (to, payload) => {
      emails.push({ to, payload });
      return true;
    },
    ...overrides,
  };
  return { deps, pushes, emails, removed };
}

// Mardi 20 octobre 2026, 17 h 31 à Paris.
const NOW = new Date("2026-10-20T15:31:00Z");

describe("envoi des rappels", () => {
  it("envoie le plat du soir sur chaque appareil, avec le lien vers le menu", async () => {
    const { deps, pushes, emails } = fakeDeps();
    const res = await runNotifications(deps, NOW);
    expect(res).toMatchObject({ due: 1, sent: 1 });
    expect(pushes).toHaveLength(2);
    expect(pushes[0]!.payload).toEqual({
      kind: "dinner",
      title: "Ce soir",
      body: "Ce soir : réchauffe le chili 3 min au micro-ondes.",
      url: "/app",
      day: "2026-10-20",
    });
    expect(emails).toHaveLength(0);
  });

  it("pas de doublon sur deux exécutions du cron", async () => {
    const { deps, pushes } = fakeDeps();
    await runNotifications(deps, NOW);
    const second = await runNotifications(deps, new Date("2026-10-20T15:40:00Z"));
    expect(second).toMatchObject({ sent: 0, duplicates: 1 });
    expect(pushes).toHaveLength(2);
  });

  it("rien à dire, rien d'envoyé (et rien de réservé)", async () => {
    let claimed = 0;
    const { deps, pushes } = fakeDeps({
      content: async () => null,
      claim: async () => {
        claimed++;
        return true;
      },
    });
    expect(await runNotifications(deps, NOW)).toMatchObject({ sent: 0, empty: 1 });
    expect(claimed).toBe(0);
    expect(pushes).toHaveLength(0);
  });

  it("e-mail de repli quand aucun appareil ne reçoit, abonnement expiré oublié", async () => {
    const { deps, emails, removed } = fakeDeps({ sendPush: async (sub) => (sub.id === "s1" ? "gone" : "error") });
    await runNotifications(deps, NOW);
    expect(removed).toEqual(["s1"]);
    expect(emails).toEqual([{ to: "camille@example.com", payload: expect.objectContaining({ kind: "dinner" }) }]);
  });

  it("e-mail en plus du push quand le compte le demande", async () => {
    const { deps, emails, pushes } = fakeDeps();
    const base = await deps.recipients();
    deps.recipients = async () => base.map((r) => ({ ...r, prefs: { ...r.prefs, email: true } }));
    await runNotifications(deps, NOW);
    expect(pushes).toHaveLength(2);
    expect(emails).toHaveLength(1);
  });
});
