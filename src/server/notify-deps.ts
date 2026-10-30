import "server-only";
import webpush from "web-push";
import type { NotificationKind, NotificationPrefs } from "@/engine/notifications";
import { fr } from "@/i18n/fr";
import { notificationsSchema, parseSettings } from "@/lib/settings";
import { type Db, rpc, withAdmin } from "@/server/db";
import { householdCan } from "@/server/entitlements-load";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { buildMenuView } from "@/server/menu-view";
import type { NotifyDeps, Payload, Recipient, Subscription } from "@/server/notify";
import { emailOf } from "@/server/users";
import { currentAndNext, engineEnvFor } from "@/server/weeks";

/** Dépendances réelles de l'envoi : base (clé de service), Web Push (VAPID) et e-mail (Resend). */

export const vapidConfigured = () =>
  !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY &&
  !!process.env.VAPID_SUBJECT;

export async function sendWebPush(sub: Subscription, payload: Payload): Promise<"ok" | "gone" | "error"> {
  if (!vapidConfigured()) return "error";
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), {
      TTL: 3600,
      urgency: "normal",
      vapidDetails: {
        subject: process.env.VAPID_SUBJECT!,
        publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      },
    });
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "error";
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function emailSender(baseUrl: string) {
  return async (to: string, payload: Payload) => {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) return false;
    const link = new URL(payload.url, baseUrl).toString();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: payload.body,
        text: `${payload.body}\n\n${fr.notifications.emailOpen} : ${link}\n\n${fr.notifications.emailFooter}`,
        html: `<p style="font-size:18px">${escapeHtml(payload.body)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(fr.notifications.emailOpen)}</a></p><p style="color:#666;font-size:13px">${escapeHtml(fr.notifications.emailFooter)}</p>`,
      }),
    }).catch(() => null);
    return !!res?.ok;
  };
}

export async function subscriptionsOf(db: Db, userId: string): Promise<Subscription[]> {
  const data = await db
    .selectFrom("push_subscriptions")
    .select(["id", "endpoint", "keys"])
    .where("user_id", "=", userId)
    .execute();
  return data.map((s) => ({ id: s.id, endpoint: s.endpoint, keys: s.keys as Subscription["keys"] }));
}

/** Comptes ayant consenti aux notifications, avec leur foyer actif (ou le premier) et ses horaires. */
async function recipients(db: Db): Promise<Recipient[]> {
  const settings = await db.selectFrom("user_settings").select(["user_id", "notifications"]).execute();
  const prefs = new Map<string, NotificationPrefs>();
  for (const row of settings) {
    const parsed = notificationsSchema.safeParse(row.notifications ?? {});
    if (parsed.success && parsed.data.consentAt && (parsed.data.push || parsed.data.email))
      prefs.set(row.user_id, parsed.data);
  }
  if (!prefs.size) return [];
  const users = [...prefs.keys()];
  const [profiles, memberships] = await Promise.all([
    db.selectFrom("profiles").select(["user_id", "active_household"]).where("user_id", "in", users).execute(),
    db
      .selectFrom("memberships")
      .select(["user_id", "household_id", "created_at"])
      .where("user_id", "in", users)
      .orderBy("created_at")
      .execute(),
  ]);
  const householdOf = new Map<string, string>();
  for (const m of memberships) if (!householdOf.has(m.user_id)) householdOf.set(m.user_id, m.household_id);
  for (const p of profiles) {
    if (
      p.active_household &&
      memberships.some((m) => m.user_id === p.user_id && m.household_id === p.active_household)
    ) {
      householdOf.set(p.user_id, p.active_household);
    }
  }
  const ids = [...new Set(householdOf.values())];
  if (!ids.length) return [];
  const [households, hs] = await Promise.all([
    db.selectFrom("households").select(["id", "timezone"]).where("id", "in", ids).execute(),
    db
      .selectFrom("household_settings")
      .select(["household_id", "diet", "menu", "session", "shopping", "equipment", "canteen"])
      .where("household_id", "in", ids)
      .execute(),
  ]);
  const tz = new Map(households.map((h) => [h.id, h.timezone]));
  const schedule = new Map(
    hs.map((row) => {
      const s = parseSettings(row);
      return [
        row.household_id,
        { sessionDay: s.session.day, sessionTime: s.session.time, shoppingDay: s.shopping.shoppingDay },
      ];
    }),
  );
  return users.flatMap((userId) => {
    const householdId = householdOf.get(userId);
    if (!householdId || !tz.has(householdId)) return [];
    return [
      {
        userId,
        householdId,
        timezone: tz.get(householdId)!,
        prefs: prefs.get(userId)!,
        schedule: schedule.get(householdId) ?? { sessionDay: 0, sessionTime: "14:00", shoppingDay: 6 },
      },
    ];
  });
}

/** Contenu d'un rappel, calculé par le moteur à partir de la semaine du foyer. */
async function content(db: Db, householdId: string, kind: NotificationKind): Promise<string | number | null> {
  // Rappels du dîner et de décongélation : offre payante (SPEC_JANVIER §8).
  if (
    (kind === "dinner" || kind === "thaw") &&
    !(await householdCan(householdId, "notifications.meals", {}, db))
  )
    return null;
  const ctx = await loadHouseholdContext(householdId, db);
  const { today, current, next } = currentAndNext(ctx);
  if (kind === "shopping") {
    const week = next ?? current;
    if (!week) return null;
    const { n } = await db
      .selectFrom("shopping_items")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("week_id", "=", week.id)
      .where("checked", "=", false)
      .executeTakeFirstOrThrow();
    return Number(n);
  }
  if (kind === "session") return (next ?? current) ? 1 : null;
  if (!current) return null;
  const env = await engineEnvFor(ctx, Math.random, db);
  const view = buildMenuView(ctx, env, current, portionModelFor(ctx, current.start_date), today);
  const day = view.days.find((d) => d.iso === today);
  if (!day) return null;
  if (kind === "dinner")
    return day.tonight ? day.tonight.charAt(0).toLowerCase() + day.tonight.slice(1) : null;
  return day.thaw.length ? day.thaw.join(", ") : null;
}

export function createNotifyDeps(baseUrl: string): NotifyDeps {
  return {
    recipients: () => withAdmin(recipients),
    content: (householdId, kind) => withAdmin((db) => content(db, householdId, kind)),
    claim: async (userId, kind, day, payload) => {
      const data = await withAdmin((db) =>
        rpc<boolean>(db, "claim_notification", {
          p_user: userId,
          p_kind: kind,
          p_day: day,
          p_payload: payload,
        }),
      );
      return data === true;
    },
    subscriptions: (userId) => withAdmin((db) => subscriptionsOf(db, userId)),
    sendPush: sendWebPush,
    removeSubscription: async (id) => {
      await withAdmin((db) => db.deleteFrom("push_subscriptions").where("id", "=", id).execute());
    },
    emailOf,
    sendEmail: emailSender(baseUrl),
  };
}
