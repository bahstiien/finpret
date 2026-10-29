import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { HouseholdRole } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { auth } from "@/server/auth";

/** Foyer actif mémorisé par appareil (SPEC §4). */
export const ACTIVE_HOUSEHOLD_COOKIE = "active_household";

export type HouseholdSummary = { id: string; name: string; role: HouseholdRole };

export type SessionUser = { id: string; email: string };

/** Session Better Auth de la requête (lue en base : une session révoquée l'est immédiatement). */
export const getAuthSession = cache(async () => auth().api.getSession({ headers: await headers() }));

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getAuthSession();
  return session ? { id: session.user.id, email: session.user.email } : null;
});

export async function requireUser(next = "/app") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, active_household")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
});

export const getHouseholds = cache(async (): Promise<HouseholdSummary[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, households(id, name)")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).flatMap((m) => (m.households ? [{ ...m.households, role: m.role }] : []));
});

/** Foyer actif : celui de l'appareil, sinon celui du profil, sinon le premier. */
export const getActiveHousehold = cache(async (): Promise<HouseholdSummary | null> => {
  const households = await getHouseholds();
  if (households.length === 0) return null;
  const fromDevice = (await cookies()).get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  const fromProfile = (await getProfile())?.active_household;
  return (
    households.find((h) => h.id === fromDevice) ??
    households.find((h) => h.id === fromProfile) ??
    households[0] ??
    null
  );
});

/** Page de l'application : il faut une session et un foyer. */
export async function requireHousehold(next = "/app") {
  const user = await requireUser(next);
  const household = await getActiveHousehold();
  if (!household) redirect("/onboarding");
  return { user, household };
}
