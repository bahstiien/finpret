"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ASSOCIATION_COOKIE } from "@/lib/association-code";
import { mondayOf, nextMonday, todayIn } from "@/lib/dates";
import { type OnboardingInput, onboardingSchema } from "@/lib/onboarding";
import { defaultSettings, notificationsSchema, SETTINGS_VERSION } from "@/lib/settings";
import { json, rpc } from "@/server/db";
import { toUserMessage } from "@/server/errors";
import { ACTIVE_HOUSEHOLD_COOKIE, getActiveHousehold, requireUser, withSession } from "@/server/session";
import { approvedAssociation, attachHousehold } from "@/server/associations";
import { sendWelcome } from "@/server/emails";
import { trackEvent } from "@/server/events";
import { generateAndStore } from "@/server/weeks";
import { fr } from "@/i18n/fr";

/** En cas de succès, l'action redirige vers le récapitulatif ; elle ne renvoie que les erreurs. */
export type OnboardingResult = { ok: false; error: string };

/**
 * Fin de l'onboarding (§5) : foyer (créé ou complété), membres, présence, réglages, puis génération
 * de la première semaine, en brouillon, pour le lundi suivant.
 */
export async function completeOnboarding(raw: OnboardingInput): Promise<OnboardingResult | void> {
  const user = await requireUser("/onboarding");
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: fr.onboarding.invalid };
  const input = parsed.data;

  // Foyer : celui en cours d'onboarding (créé sans être paramétré), sinon un nouveau.
  const active = await getActiveHousehold();
  let householdId: string;
  if (active && active.role === "admin") {
    const done = await withSession(async (db) => {
      const data = await db
        .selectFrom("households")
        .select("onboarded_at")
        .where("id", "=", active.id)
        .executeTakeFirst();
      if (data?.onboarded_at) return true;
      await db
        .updateTable("households")
        .set({ name: input.household.name })
        .where("id", "=", active.id)
        .execute();
      return false;
    });
    if (done) return { ok: false, error: fr.onboarding.alreadyDone };
    householdId = active.id;
  } else {
    try {
      householdId = await withSession((db) =>
        rpc<string>(db, "create_household", { p_name: input.household.name }),
      );
    } catch (e) {
      return { ok: false, error: toUserMessage(e) };
    }
  }
  (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Membres (le premier adulte est le compte qui fait l'onboarding) et présence.
  let members: { id: string }[];
  try {
    members = await withSession(async (db) => {
      await db.deleteFrom("members").where("household_id", "=", householdId).execute();
      return db
        .insertInto("members")
        .values(
          input.household.members.map((m, i) => ({
            household_id: householdId,
            name: m.name,
            kind: m.kind,
            birthdate: m.kind === "child" ? m.birthdate : null,
            user_id: i === 0 && m.kind === "adult" ? user.id : null,
          })),
        )
        .returning("id")
        .execute();
    });
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  // Code d'association (cookie fp_asso) : rattachement du foyer, essai de 30 jours, puis enfants reliés à leur école.
  const jar = await cookies();
  const association = await approvedAssociation(jar.get(ASSOCIATION_COOKIE)?.value);
  if (association) {
    const attached = await attachHousehold(householdId, association.id, user.id);
    jar.delete(ASSOCIATION_COOKIE);
    if (attached.ok) {
      const allowed = new Set(association.schools.map((s) => s.id));
      const links = input.household.members.flatMap((m, i) =>
        m.kind === "child" && m.schoolId && allowed.has(m.schoolId) && members[i]
          ? [{ member_id: members[i].id, school_id: m.schoolId, canteen_days: m.canteenDays }]
          : [],
      );
      if (links.length)
        await withSession((db) => db.insertInto("member_schools").values(links).execute()).catch(() => null);
    }
  }
  const absences = input.rhythm.absences.filter((a) => members[a.member]);
  if (absences.length) {
    try {
      await withSession((db) =>
        db
          .insertInto("presence_rules")
          .values(
            absences.map((a) => {
              const [weekday, meal] = a.slot.split("-") as [string, "lunch" | "dinner"];
              return { member_id: members[a.member]!.id, weekday: Number(weekday), meal, present: false };
            }),
          )
          .execute(),
      );
    } catch (e) {
      return { ok: false, error: toUserMessage(e) };
    }
  }

  // Réglages.
  const defaults = defaultSettings();
  const settings = {
    diet: { ...defaults.diet, ...input.diet },
    menu: { ...defaults.menu, skip: input.rhythm.skip, weekend: input.rhythm.weekend },
    session: { ...defaults.session, ...input.rhythm.session },
    shopping: { ...defaults.shopping, shoppingDay: input.habits.shoppingDay, store: input.habits.store },
    equipment: input.equipment,
  };
  const values = {
    version: SETTINGS_VERSION,
    diet: json(settings.diet),
    menu: json(settings.menu),
    session: json(settings.session),
    shopping: json(settings.shopping),
    equipment: json(settings.equipment),
  };
  try {
    await withSession((db) =>
      db
        .insertInto("household_settings")
        .values({ household_id: householdId, ...values })
        .onConflict((oc) => oc.column("household_id").doUpdateSet(values))
        .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }

  const household = await withSession(async (db) => {
    const row = await db
      .selectFrom("households")
      .select("timezone")
      .where("id", "=", householdId)
      .executeTakeFirst();
    await db
      .updateTable("households")
      .set({
        onboarded_at: new Date().toISOString(),
        alternating_from:
          input.household.alternating.enabled && input.household.alternating.from
            ? mondayOf(input.household.alternating.from)
            : null,
      })
      .where("id", "=", householdId)
      .execute();
    return row;
  });
  const today = todayIn(household?.timezone ?? "Europe/Paris");

  await trackEvent("onboarding_done", { userId: user.id, householdId });
  await trackEvent("trial_started", { userId: user.id, householdId });
  if (user.email)
    await sendWelcome(user.email, user.id, input.household.members[0]?.name ?? "").catch(() => null);

  // Heures de notification du compte (le consentement aux notifications se donne plus tard, §4).
  await withSession((db) =>
    db
      .updateTable("user_settings")
      .set({
        notifications: json(
          notificationsSchema.parse({
            dinner: { enabled: true, time: input.habits.dinnerTime },
            thaw: { enabled: true, time: input.habits.thawTime },
          }),
        ),
      })
      .where("user_id", "=", user.id)
      .execute(),
  );

  // Première semaine.
  const start = nextMonday(today);
  const generated = await generateAndStore(householdId, start);
  if (!generated.ok) return { ok: false, error: fr.onboarding.generationFailed };
  redirect(`/onboarding/recap?week=${start}`);
}
