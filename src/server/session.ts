import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/server/auth";
import { type Db, withAnon, withUser } from "@/server/db";
import type { HouseholdRole } from "@/server/db.types";

/** Foyer actif mémorisé par appareil (SPEC §4). */
export const ACTIVE_HOUSEHOLD_COOKIE = "active_household";

export type HouseholdSummary = { id: string; name: string; role: HouseholdRole };

export type SessionUser = { id: string; email: string };

/**
 * Session Better Auth de la requête (lue en base : une session révoquée l'est immédiatement).
 * `headers()` d'abord : il marque la page comme dynamique avant tout accès à la base (le build n'a pas de base).
 */
export const getAuthSession = cache(async () => {
  const requestHeaders = await headers();
  return auth().api.getSession({ headers: requestHeaders });
});

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getAuthSession();
  return session ? { id: session.user.id, email: session.user.email } : null;
});

export async function requireUser(next = "/app") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * Requêtes pour la requête HTTP en cours : au nom de l'utilisateur connecté (RLS `authenticated`), sinon en `anon`.
 */
export async function withSession<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const user = await getUser();
  return user ? withUser(user.id, fn) : withAnon(fn);
}

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const row = await withUser(user.id, (db) =>
    db
      .selectFrom("profiles")
      .select(["display_name", "active_household"])
      .where("user_id", "=", user.id)
      .executeTakeFirst(),
  );
  return row ?? null;
});

export const getHouseholds = cache(async (): Promise<HouseholdSummary[]> => {
  const user = await getUser();
  if (!user) return [];
  return withUser(user.id, (db) =>
    db
      .selectFrom("memberships")
      .innerJoin("households", "households.id", "memberships.household_id")
      .select(["households.id", "households.name", "memberships.role"])
      .where("memberships.user_id", "=", user.id)
      .orderBy("memberships.created_at")
      .execute(),
  );
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
