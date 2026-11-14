import "server-only";
import { effectiveLevel, endTime, packaging } from "@/engine/first-session";
import { dur } from "@/engine/format";
import { type MessageInput, type MessageKey, MESSAGE_KEYS, planMessage } from "@/engine/getting-started-messages";
import { fr } from "@/i18n/fr";
import { type MessageVars, messagesFr } from "@/i18n/getting-started-messages";
import { todayIn } from "@/lib/dates";
import { notificationsSchema, parseSettings } from "@/lib/settings";
import { type Db, json, withAdmin } from "@/server/db";
import { sendGettingStartedEmail } from "@/server/emails";
import { trackEvent } from "@/server/events";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { firstSessionInfo, type FirstSessionInfo, GETTING_STARTED_SINCE, syncChecklist } from "@/server/getting-started";
import type { Payload } from "@/server/notify";
import { createNotifyDeps } from "@/server/notify-deps";
import { currentAndNext, engineEnvFor, summarize } from "@/server/weeks";

/**
 * Séquence de messages de la prise en main (SPEC_PRISE_EN_MAIN §4.5) : appelée par le planificateur (toutes les
 * 15 minutes) et, pour la bienvenue, à la fin de l'onboarding. La règle d'envoi est dans `planMessage` (moteur pur) ;
 * ici : lecture des données, réservation idempotente dans `notification_log`, envoi (e-mail, Web Push), événements.
 */

const DAY_MS = 86_400_000;
/** J14 + 6 jours de prolongation pour les messages rattachés à la session, avec une marge. */
const LOOKBACK_DAYS = 22;

export type RunOptions = { householdId?: string; userId?: string };
export type RunSummary = { households: number; considered: number; sent: number; duplicates: number };

const weekdayName = (sessionDay: number) => fr.days[(sessionDay + 6) % 7]!.toLowerCase();

/** Variables des textes d'un foyer, calculées avec le niveau effectif de la première session. */
async function varsFor(
  db: Db,
  householdId: string,
  userId: string,
  first: FirstSessionInfo,
): Promise<MessageVars> {
  const ctx = await loadHouseholdContext(householdId, db);
  const { current, next } = currentAndNext(ctx);
  const week = next ?? current;
  const own = ctx.members.find((m) => m.userId === userId);
  const base: MessageVars = {
    name: own?.name ?? "",
    meals: 0,
    sessionDay: weekdayName(ctx.settings.session.day),
    sessionTime: ctx.settings.session.time,
    articles: 0,
    duration: "",
    end: "",
    boxes: 0,
    fridge: 0,
    freezer: 0,
  };
  if (!week) return base;
  const env = await engineEnvFor(ctx, Math.random, db);
  const level = effectiveLevel({ firstSession: first.active, override: first.override, setting: ctx.settings.session.level });
  const summary = await summarize(ctx, week.plan, env, level);
  const pack = packaging(env, week.plan, portionModelFor(ctx, week.start_date));
  return {
    ...base,
    meals: summary.meals,
    articles: summary.shoppingItems,
    duration: dur(summary.sessionMinutes),
    end: endTime(ctx.settings.session.time, summary.sessionMinutes),
    boxes: pack.boxes.length,
    fridge: pack.fridge,
    freezer: pack.freezer,
  };
}

export async function runGettingStartedMessages(
  baseUrl: string,
  now = new Date(),
  only: RunOptions = {},
): Promise<RunSummary> {
  const deps = createNotifyDeps(baseUrl);
  const summary: RunSummary = { households: 0, considered: 0, sent: 0, duplicates: 0 };

  const since = new Date(Math.max(Date.parse(GETTING_STARTED_SINCE), now.getTime() - LOOKBACK_DAYS * DAY_MS));
  const households = await withAdmin((db) => {
    let query = db
      .selectFrom("households")
      .select(["id", "timezone", "onboarded_at", "created_by"])
      .where("onboarded_at", "is not", null)
      .where("onboarded_at", ">=", since.toISOString());
    if (only.householdId) query = query.where("id", "=", only.householdId);
    return query.execute();
  });

  for (const h of households) {
    const checklist = await syncChecklist(h.id, { now });
    if (!checklist) continue;
    summary.households++;
    const tz = h.timezone;
    const today = todayIn(tz, now);
    const weekFloor = new Date(Date.parse(`${today}T12:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);

    const { settingsRow, weeks, generated, members } = await withAdmin(async (db) => ({
      settingsRow: await db
        .selectFrom("household_settings")
        .select(["diet", "menu", "session", "shopping", "equipment", "canteen"])
        .where("household_id", "=", h.id)
        .executeTakeFirst(),
      weeks: await db
        .selectFrom("weeks")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("household_id", "=", h.id)
        .where("start_date", ">=", weekFloor)
        .executeTakeFirstOrThrow(),
      generated: await db
        .selectFrom("events")
        .select("props")
        .where("household_id", "=", h.id)
        .where("name", "=", "week_generated")
        .execute(),
      members: await db.selectFrom("memberships").select("user_id").where("household_id", "=", h.id).execute(),
    }));
    const settings = parseSettings(
      settingsRow ?? { diet: {}, menu: {}, session: {}, shopping: {}, equipment: {}, canteen: {} },
    );
    const weeksGenerated = new Set(
      generated.map((e) => (e.props as { week?: string } | null)?.week).filter(Boolean),
    );
    const steps = checklist.state.steps;

    for (const { user_id: userId } of members) {
      if (only.userId && only.userId !== userId) continue;
      const [{ prefsRow, log }, subs] = await Promise.all([
        withAdmin(async (db) => ({
          prefsRow: await db
            .selectFrom("user_settings")
            .select("notifications")
            .where("user_id", "=", userId)
            .executeTakeFirst(),
          log: await db
            .selectFrom("notification_log")
            .select(["day", "payload"])
            .where("user_id", "=", userId)
            .where("kind", "=", "onboarding")
            .execute(),
        })),
        deps.subscriptions(userId),
      ]);
      const prefs = notificationsSchema.parse(prefsRow?.notifications ?? {});
      const sent: MessageInput["sent"] = {};
      for (const row of log) {
        const key = (row.payload as { key?: string } | null)?.key as MessageKey | undefined;
        if (key && (MESSAGE_KEYS as readonly string[]).includes(key)) sent[key] = row.day;
      }
      const input: MessageInput = {
        now,
        tz,
        isCreator: h.created_by === userId,
        signupAt: h.onboarded_at!,
        sessionDay: settings.session.day,
        shoppingDay: settings.shopping.shoppingDay,
        hasWeek: Number(weeks.n) > 0,
        steps: { shop: steps.shop.done, startSession: steps.start_session.done },
        sessionDoneAt: steps.finish_session.doneAt,
        secondWeekGenerated: weeksGenerated.size >= 2,
        dismissed: checklist.dismissed,
        channels: { email: prefs.marketingEmails, push: !!prefs.consentAt && prefs.push && subs.length > 0 },
        sent,
      };
      summary.considered++;
      const plan = planMessage(input);
      if (!plan.send) continue;
      const key = plan.send;

      // Réservation idempotente : (compte, type, jour) et (compte, clé) sont uniques dans `notification_log` ;
      // `on conflict do nothing` sans cible couvre les deux index.
      const claimed = await withAdmin((db) =>
        db
          .insertInto("notification_log")
          .values({ user_id: userId, kind: "onboarding", day: today, payload: json({ key }) })
          .onConflict((oc) => oc.doNothing())
          .returning("id")
          .executeTakeFirst(),
      );
      if (!claimed) {
        summary.duplicates++;
        continue;
      }

      const first = await firstSessionInfo(h.id);
      const vars = await withAdmin((db) => varsFor(db, h.id, userId, first));
      const copy = messagesFr[key];
      summary.sent++;

      if (input.channels.email) {
        const to = await deps.emailOf(userId);
        if (to && (await sendGettingStartedEmail(to, userId, key, vars)).ok) {
          await trackEvent("onboarding_message_sent", {
            userId,
            householdId: h.id,
            dedupeKey: `${key}:email`,
            props: { key, channel: "email" },
          });
        }
      }
      if (input.channels.push) {
        const payload: Payload = { kind: "onboarding", title: copy.push.title, body: copy.push.body(vars), url: copy.url, day: today };
        let delivered = 0;
        for (const sub of subs) {
          const res = await deps.sendPush(sub, payload);
          if (res === "ok") delivered++;
          if (res === "gone") await deps.removeSubscription(sub.id);
        }
        if (delivered > 0) {
          await trackEvent("onboarding_message_sent", {
            userId,
            householdId: h.id,
            dedupeKey: `${key}:push`,
            props: { key, channel: "push" },
          });
        }
      }
    }
  }
  return summary;
}
