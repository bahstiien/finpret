"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { mondayOf, todayIn } from "@/lib/dates";
import { notificationsSchema, SETTINGS_SCHEMAS, SETTINGS_VERSION } from "@/lib/settings";
import { auth } from "@/server/auth";
import { json, withAdmin } from "@/server/db";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { loadHouseholdContext } from "@/server/household-context";
import { ACTIVE_HOUSEHOLD_COOKIE, requireHousehold, requireUser, withSession } from "@/server/session";
import { stripeAvailable, stripeClient } from "@/server/stripe";
import { cancelHouseholdSubscriptions } from "@/server/subscription-cleanup";
import { deleteUser } from "@/server/users";
import { generateAndStore } from "@/server/weeks";

type Section = keyof typeof SETTINGS_SCHEMAS;
/** Sections dont un changement modifie la composition de la semaine (le reste se recalcule à l'affichage). */
const AFFECTS_PLAN: Section[] = ["diet", "menu"];

async function requireAdmin() {
  const { user, household } = await requireHousehold("/settings");
  if (household.role !== "admin") return { user, household, forbidden: true as const };
  return { user, household, forbidden: false as const };
}

/** Semaine en préparation (pas encore commencée) à laquelle un réglage peut s'appliquer. */
async function pendingWeek(householdId: string) {
  const ctx = await loadHouseholdContext(householdId);
  const monday = mondayOf(todayIn(ctx.timezone));
  return ctx.weeks.find((w) => w.start_date > monday) ?? null;
}

export type SaveResult = ActionResult<{ pendingWeekStart: string | null }>;

/** Enregistrement automatique d'une section (§6), validé par Zod. */
export async function saveSettings(section: Section, value: unknown): Promise<SaveResult> {
  const { household, forbidden } = await requireAdmin();
  if (forbidden) return { ok: false, error: fr.errors.forbidden };
  const schema = SETTINGS_SCHEMAS[section];
  if (!schema) return { ok: false, error: fr.errors.generic };
  const parsed = schema.safeParse(value);
  if (!parsed.success) return { ok: false, error: fr.settings.invalid };
  try {
    await withSession((db) =>
      db
        .updateTable("household_settings")
        .set({ [section]: json(parsed.data), version: SETTINGS_VERSION })
        .where("household_id", "=", household.id)
        .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/", "layout");
  const pending = AFFECTS_PLAN.includes(section) ? await pendingWeek(household.id) : null;
  return { ok: true, data: { pendingWeekStart: pending?.start_date ?? null } };
}

/** « Appliquer à la semaine en préparation » : recompose cette semaine avec les nouveaux réglages. */
export async function applyToPendingWeek(start: string): Promise<ActionResult> {
  const { household } = await requireHousehold("/settings");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  const res = await generateAndStore(household.id, start);
  if (!res.ok && res.reason === "locked") return { ok: false, error: fr.menuActions.locked };
  if (!res.ok) return { ok: false, error: fr.menu.impossible };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Foyer : nom, fuseau horaire, garde alternée, membres, présence
// ---------------------------------------------------------------------------

const householdSchema = z.object({
  name: z.string().trim().min(1).max(60),
  timezone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC"),
  alternatingFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export async function saveHousehold(value: unknown): Promise<ActionResult> {
  const { household, forbidden } = await requireAdmin();
  if (forbidden) return { ok: false, error: fr.errors.forbidden };
  const parsed = householdSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: fr.settings.invalid };
  try {
    await withSession((db) =>
      db
        .updateTable("households")
        .set({
          name: parsed.data.name,
          timezone: parsed.data.timezone,
          alternating_from: parsed.data.alternatingFrom ? mondayOf(parsed.data.alternatingFrom) : null,
        })
        .where("id", "=", household.id)
        .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

const memberSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(1).max(40),
    kind: z.enum(["adult", "child"]),
    birthdate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    portionOverride: z.number().min(0).max(3).nullable(),
    archived: z.boolean().default(false),
  })
  .refine((m) => m.kind === "adult" || m.birthdate !== null, { path: ["birthdate"] });

export async function saveMember(value: unknown): Promise<ActionResult<{ id: string }>> {
  const { household, forbidden } = await requireAdmin();
  if (forbidden) return { ok: false, error: fr.errors.forbidden };
  const parsed = memberSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: fr.settings.invalid };
  const m = parsed.data;
  const row = {
    name: m.name,
    kind: m.kind,
    birthdate: m.kind === "child" ? m.birthdate : null,
    portion_override: m.portionOverride,
    archived: m.archived,
  };
  let data: { id: string };
  try {
    data = await withSession((db) =>
      m.id
        ? db
            .updateTable("members")
            .set(row)
            .where("id", "=", m.id)
            .where("household_id", "=", household.id)
            .returning("id")
            .executeTakeFirstOrThrow()
        : db
            .insertInto("members")
            .values({ ...row, household_id: household.id })
            .returning("id")
            .executeTakeFirstOrThrow(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

const presenceSchema = z.object({
  memberId: z.uuid(),
  weekday: z.number().int().min(1).max(7),
  meal: z.enum(["lunch", "dinner"]),
  weekParity: z.enum(["all", "A", "B"]),
  present: z.boolean(),
});

/** Présence d'un membre à un créneau ; « présent » sans règle particulière supprime la règle. */
export async function setPresence(value: unknown): Promise<ActionResult> {
  const { forbidden } = await requireAdmin();
  if (forbidden) return { ok: false, error: fr.errors.forbidden };
  const parsed = presenceSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: fr.settings.invalid };
  const p = parsed.data;
  const key = { member_id: p.memberId, weekday: p.weekday, meal: p.meal, week_parity: p.weekParity };
  try {
    await withSession<unknown>((db) =>
      p.present && p.weekParity === "all"
        ? db
            .deleteFrom("presence_rules")
            .where("member_id", "=", key.member_id)
            .where("weekday", "=", key.weekday)
            .where("meal", "=", key.meal)
            .where("week_parity", "=", key.week_parity)
            .execute()
        : db
            .insertInto("presence_rules")
            .values({ ...key, present: p.present })
            .onConflict((oc) =>
              oc.columns(["member_id", "weekday", "meal", "week_parity"]).doUpdateSet({ present: p.present }),
            )
            .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Profil (tous les comptes) : nom, notifications, appareils, suppression
// ---------------------------------------------------------------------------

export async function saveProfile(value: unknown): Promise<ActionResult> {
  const user = await requireUser("/settings/profile");
  const parsed = z.object({ displayName: z.string().trim().min(1).max(60) }).safeParse(value);
  if (!parsed.success) return { ok: false, error: fr.settings.invalid };
  try {
    await withSession((db) =>
      db
        .updateTable("profiles")
        .set({ display_name: parsed.data.displayName })
        .where("user_id", "=", user.id)
        .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function saveNotifications(value: unknown): Promise<ActionResult> {
  const user = await requireUser("/settings/profile");
  const parsed = notificationsSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: fr.settings.invalid };
  try {
    await withSession((db) =>
      db
        .updateTable("user_settings")
        .set({ notifications: json(parsed.data) })
        .where("user_id", "=", user.id)
        .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  return { ok: true, data: undefined };
}

/** Déconnexion de tous les autres appareils (§4, « appareils connectés »). */
export async function signOutOtherDevices(): Promise<ActionResult> {
  await requireUser("/settings/profile");
  try {
    await auth().api.revokeOtherSessions({ headers: await headers() });
  } catch {
    return { ok: false, error: fr.errors.generic };
  }
  return { ok: true, data: undefined };
}

/** Résilie les abonnements Stripe d'un foyer avant sa suppression ; false si la suppression doit s'arrêter. */
async function cancelSubscriptionsOf(householdId: string): Promise<boolean> {
  const stripe = stripeAvailable() ? stripeClient() : null;
  const result = await withAdmin((db) => cancelHouseholdSubscriptions(db, householdId, stripe));
  return result.ok;
}

/**
 * Suppression du compte (RGPD, §4) : les foyers dont il est le seul administrateur sont supprimés
 * avec lui, après confirmation forte (saisie de « SUPPRIMER »).
 */
export async function deleteAccount(formData: FormData): Promise<ActionResult> {
  const user = await requireUser("/settings/profile");
  if (
    String(formData.get("confirm") ?? "")
      .trim()
      .toUpperCase() !== fr.settings.data.confirmWord
  ) {
    return { ok: false, error: fr.settings.data.confirmMismatch };
  }
  let orphans: string[];
  try {
    orphans = await withSession(async (db) => {
      const memberships = await db
        .selectFrom("memberships")
        .select(["household_id", "role"])
        .where("user_id", "=", user.id)
        .execute();
      const ids: string[] = [];
      for (const m of memberships) {
        if (m.role !== "admin") continue;
        const { n } = await db
          .selectFrom("memberships")
          .select((eb) => eb.fn.countAll<number>().as("n"))
          .where("household_id", "=", m.household_id)
          .where("role", "=", "admin")
          .executeTakeFirstOrThrow();
        if (Number(n) <= 1) ids.push(m.household_id);
      }
      return ids;
    });
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  for (const householdId of orphans) {
    // L'abonnement Stripe est résilié avant le foyer : sinon la facturation continuerait sans compte.
    const cancelled = await cancelSubscriptionsOf(householdId);
    if (!cancelled) return { ok: false, error: fr.errors.subscriptionCancel };
    try {
      await withSession((db) => db.deleteFrom("households").where("id", "=", householdId).execute());
    } catch (e) {
      return { ok: false, error: toUserMessage(e) };
    }
  }
  try {
    // La suppression du compte emporte ses sessions : il ne reste qu'à effacer les cookies.
    await deleteUser(user.id);
  } catch {
    return { ok: false, error: fr.errors.generic };
  }
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.includes("better-auth")) jar.delete(c.name);
  jar.delete(ACTIVE_HOUSEHOLD_COOKIE);
  redirect("/");
}

/** Suppression du foyer par l'administrateur, après saisie de son nom. */
export async function deleteHousehold(formData: FormData): Promise<ActionResult> {
  const { household, forbidden } = await requireAdmin();
  if (forbidden) return { ok: false, error: fr.errors.forbidden };
  if (String(formData.get("confirm") ?? "").trim() !== household.name) {
    return { ok: false, error: fr.settings.data.confirmMismatch };
  }
  if (!(await cancelSubscriptionsOf(household.id))) return { ok: false, error: fr.errors.subscriptionCancel };
  try {
    await withSession((db) => db.deleteFrom("households").where("id", "=", household.id).execute());
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  (await cookies()).delete(ACTIVE_HOUSEHOLD_COOKIE);
  redirect("/app");
}

const memberSchoolSchema = z.object({
  memberId: z.uuid(),
  schoolId: z.uuid().nullable(),
  days: z.array(z.number().int().min(1).max(5)).max(5),
});

/**
 * Relie un enfant à l'école de l'association du foyer, avec ses jours de cantine (SPEC_JANVIER §3 A).
 * `schoolId: null` retire le lien. La RLS (`school_allowed_for_member`) refuse une école d'une autre association.
 */
export async function saveMemberSchool(value: unknown): Promise<ActionResult> {
  const { household, forbidden } = await requireAdmin();
  if (forbidden) return { ok: false, error: fr.errors.forbidden };
  const parsed = memberSchoolSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: fr.settings.invalid };
  const { memberId, schoolId, days } = parsed.data;
  try {
    const found = await withSession(async (db) => {
      // L'enfant appartient bien au foyer actif.
      const kid = await db
        .selectFrom("members")
        .select("id")
        .where("id", "=", memberId)
        .where("household_id", "=", household.id)
        .where("kind", "=", "child")
        .executeTakeFirst();
      if (!kid) return false;
      if (schoolId) {
        await db
          .insertInto("member_schools")
          .values({ member_id: memberId, school_id: schoolId, canteen_days: days })
          .onConflict((oc) => oc.column("member_id").doUpdateSet({ school_id: schoolId, canteen_days: days }))
          .execute();
      } else {
        await db.deleteFrom("member_schools").where("member_id", "=", memberId).execute();
      }
      return true;
    });
    if (!found) return { ok: false, error: fr.errors.forbidden };
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
