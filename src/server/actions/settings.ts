"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { mondayOf, todayIn } from "@/lib/dates";
import { notificationsSchema, SETTINGS_SCHEMAS, SETTINGS_VERSION } from "@/lib/settings";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { auth } from "@/server/auth";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { loadHouseholdContext } from "@/server/household-context";
import { ACTIVE_HOUSEHOLD_COOKIE, requireHousehold, requireUser } from "@/server/session";
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("household_settings")
    .update({ [section]: parsed.data as Json, version: SETTINGS_VERSION } as { version: number } & Partial<
      Record<Section, Json>
    >)
    .eq("household_id", household.id);
  if (error) return { ok: false, error: toUserMessage(error) };
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      alternating_from: parsed.data.alternatingFrom ? mondayOf(parsed.data.alternatingFrom) : null,
    })
    .eq("id", household.id);
  if (error) return { ok: false, error: toUserMessage(error) };
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
  const supabase = await createClient();
  const row = {
    name: m.name,
    kind: m.kind,
    birthdate: m.kind === "child" ? m.birthdate : null,
    portion_override: m.portionOverride,
    archived: m.archived,
  };
  const { data, error } = m.id
    ? await supabase
        .from("members")
        .update(row)
        .eq("id", m.id)
        .eq("household_id", household.id)
        .select("id")
        .single()
    : await supabase
        .from("members")
        .insert({ ...row, household_id: household.id })
        .select("id")
        .single();
  if (error) return { ok: false, error: toUserMessage(error) };
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
  const supabase = await createClient();
  const key = { member_id: p.memberId, weekday: p.weekday, meal: p.meal, week_parity: p.weekParity };
  const { error } =
    p.present && p.weekParity === "all"
      ? await supabase.from("presence_rules").delete().match(key)
      : await supabase.from("presence_rules").upsert({ ...key, present: p.present });
  if (error) return { ok: false, error: toUserMessage(error) };
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function saveNotifications(value: unknown): Promise<ActionResult> {
  const user = await requireUser("/settings/profile");
  const parsed = notificationsSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: fr.settings.invalid };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .update({ notifications: parsed.data as Json })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: toUserMessage(error) };
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
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("household_id, role")
    .eq("user_id", user.id);
  for (const m of memberships ?? []) {
    if (m.role !== "admin") continue;
    const { count } = await supabase
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("household_id", m.household_id)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) await supabase.from("households").delete().eq("id", m.household_id);
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
  const supabase = await createClient();
  const { error } = await supabase.from("households").delete().eq("id", household.id);
  if (error) return { ok: false, error: toUserMessage(error) };
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
  const supabase = await createClient();
  // L'enfant appartient bien au foyer actif.
  const { data: kid } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("household_id", household.id)
    .eq("kind", "child")
    .maybeSingle();
  if (!kid) return { ok: false, error: fr.errors.forbidden };
  const { error } = schoolId
    ? await supabase
        .from("member_schools")
        .upsert({ member_id: memberId, school_id: schoolId, canteen_days: days }, { onConflict: "member_id" })
    : await supabase.from("member_schools").delete().eq("member_id", memberId);
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
