"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mondayOf, nextMonday, todayIn } from "@/lib/dates";
import { type OnboardingInput, onboardingSchema } from "@/lib/onboarding";
import { defaultSettings, notificationsSchema, SETTINGS_VERSION } from "@/lib/settings";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/server/errors";
import { ACTIVE_HOUSEHOLD_COOKIE, getActiveHousehold, requireUser } from "@/server/session";
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
  const supabase = await createClient();

  // Foyer : celui en cours d'onboarding (créé sans être paramétré), sinon un nouveau.
  const active = await getActiveHousehold();
  let householdId: string;
  if (active && active.role === "admin") {
    const { data } = await supabase.from("households").select("onboarded_at").eq("id", active.id).single();
    if (data?.onboarded_at) return { ok: false, error: fr.onboarding.alreadyDone };
    householdId = active.id;
    await supabase.from("households").update({ name: input.household.name }).eq("id", householdId);
  } else {
    const { data, error } = await supabase.rpc("create_household", { p_name: input.household.name });
    if (error) return { ok: false, error: toUserMessage(error) };
    householdId = data;
  }
  (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Membres (le premier adulte est le compte qui fait l'onboarding) et présence.
  await supabase.from("members").delete().eq("household_id", householdId);
  const { data: members, error: membersError } = await supabase
    .from("members")
    .insert(
      input.household.members.map((m, i) => ({
        household_id: householdId,
        name: m.name,
        kind: m.kind,
        birthdate: m.kind === "child" ? m.birthdate : null,
        user_id: i === 0 && m.kind === "adult" ? user.id : null,
      })),
    )
    .select("id");
  if (membersError) return { ok: false, error: toUserMessage(membersError) };
  const absences = input.rhythm.absences.filter((a) => members[a.member]);
  if (absences.length) {
    const { error } = await supabase.from("presence_rules").insert(
      absences.map((a) => {
        const [weekday, meal] = a.slot.split("-") as [string, "lunch" | "dinner"];
        return { member_id: members[a.member]!.id, weekday: Number(weekday), meal, present: false };
      }),
    );
    if (error) return { ok: false, error: toUserMessage(error) };
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
  const { error: settingsError } = await supabase.from("household_settings").upsert({
    household_id: householdId,
    version: SETTINGS_VERSION,
    diet: settings.diet as Json,
    menu: settings.menu as Json,
    session: settings.session as Json,
    shopping: settings.shopping as Json,
    equipment: settings.equipment as Json,
  });
  if (settingsError) return { ok: false, error: toUserMessage(settingsError) };

  const { data: household } = await supabase
    .from("households")
    .select("timezone")
    .eq("id", householdId)
    .single();
  const today = todayIn(household?.timezone ?? "Europe/Paris");
  await supabase
    .from("households")
    .update({
      onboarded_at: new Date().toISOString(),
      alternating_from:
        input.household.alternating.enabled && input.household.alternating.from
          ? mondayOf(input.household.alternating.from)
          : null,
    })
    .eq("id", householdId);

  // Heures de notification du compte (le consentement aux notifications se donne plus tard, §4).
  await supabase
    .from("user_settings")
    .update({
      notifications: notificationsSchema.parse({
        dinner: { enabled: true, time: input.habits.dinnerTime },
        thaw: { enabled: true, time: input.habits.thawTime },
      }) as Json,
    })
    .eq("user_id", user.id);

  // Première semaine.
  const start = nextMonday(today);
  const generated = await generateAndStore(householdId, start);
  if (!generated.ok) return { ok: false, error: fr.onboarding.generationFailed };
  redirect(`/onboarding/recap?week=${start}`);
}
