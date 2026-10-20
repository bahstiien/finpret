import "server-only";
import {
  dueNotifications,
  type HouseholdSchedule,
  localTime,
  type LocalTime,
  NOTIFICATION_URL,
  type ExtraKind,
  type NotificationKind,
  type NotificationPrefs,
} from "@/engine/notifications";
import { fr } from "@/i18n/fr";

/**
 * Envoi des rappels (§12) : appelé toutes les 15 min par le planificateur. Pour chaque compte dont l'heure
 * tombe dans la fenêtre, calcule le contenu, réserve l'envoi (idempotence par compte, type et jour) puis envoie
 * par Web Push, et par e-mail si le compte le demande ou si aucun appareil n'a reçu la notification.
 *
 * Écart avec la spec : route Next.js `/api/cron/notify` au lieu d'une Edge Function `notify` (même logique).
 */

export type Recipient = {
  userId: string;
  householdId: string;
  timezone: string;
  prefs: NotificationPrefs;
  schedule: HouseholdSchedule;
};

export type Payload = { kind: NotificationKind | ExtraKind | "test"; title: string; body: string; url: string; day: string };
export type Subscription = { id: string; endpoint: string; keys: { p256dh: string; auth: string } };

export type NotifyDeps = {
  recipients: () => Promise<Recipient[]>;
  /** Texte du rappel pour ce foyer, ou null s'il n'y a rien à dire (pas de dîner prévu, rien à décongeler…). */
  content: (householdId: string, kind: NotificationKind, local: LocalTime) => Promise<string | number | null>;
  claim: (userId: string, kind: NotificationKind | ExtraKind, day: string, payload: Payload) => Promise<boolean>;
  subscriptions: (userId: string) => Promise<Subscription[]>;
  sendPush: (sub: Subscription, payload: Payload) => Promise<"ok" | "gone" | "error">;
  removeSubscription: (id: string) => Promise<void>;
  emailOf: (userId: string) => Promise<string | null>;
  sendEmail: (to: string, payload: Payload) => Promise<boolean>;
};

/** Titre, texte et lien d'un rappel. */
export function payloadFor(kind: NotificationKind | "test", value: string | number | null, day: string): Payload {
  const t = fr.notifications;
  const body =
    kind === "dinner"
      ? t.dinner.body(String(value))
      : kind === "thaw"
        ? t.thaw.body(String(value))
        : kind === "shopping"
          ? t.shopping.body(Number(value))
          : t[kind].body;
  return { kind, title: t[kind].title, body, url: NOTIFICATION_URL[kind], day };
}

export type DeliveryResult = { push: number; email: boolean };

/** Envoie un rappel déjà réservé sur les appareils du compte, puis par e-mail si besoin. */
export async function deliver(deps: NotifyDeps, userId: string, prefs: Pick<NotificationPrefs, "push" | "email">, payload: Payload) {
  let push = 0;
  if (prefs.push) {
    for (const sub of await deps.subscriptions(userId)) {
      const res = await deps.sendPush(sub, payload);
      if (res === "ok") push++;
      // Abonnement expiré ou révoqué : on l'oublie.
      if (res === "gone") await deps.removeSubscription(sub.id);
    }
  }
  let email = false;
  if (prefs.email || (prefs.push && push === 0)) {
    const to = await deps.emailOf(userId);
    if (to) email = await deps.sendEmail(to, payload);
  }
  return { push, email } satisfies DeliveryResult;
}

export async function runNotifications(deps: NotifyDeps, now = new Date()) {
  const summary = { due: 0, sent: 0, duplicates: 0, empty: 0 };
  const contentCache = new Map<string, Promise<string | number | null>>();
  for (const r of await deps.recipients()) {
    const local = localTime(now, r.timezone);
    for (const { kind, day } of dueNotifications(r.prefs, r.schedule, local)) {
      summary.due++;
      const cacheKey = `${r.householdId}:${kind}:${day}`;
      if (!contentCache.has(cacheKey)) contentCache.set(cacheKey, deps.content(r.householdId, kind, local));
      const value = await contentCache.get(cacheKey)!;
      if (value === null || value === 0 || value === "") {
        summary.empty++;
        continue;
      }
      const payload = payloadFor(kind, value, day);
      if (!(await deps.claim(r.userId, kind, day, payload))) {
        summary.duplicates++;
        continue;
      }
      await deliver(deps, r.userId, r.prefs, payload);
      summary.sent++;
    }
  }
  return summary;
}
