"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ASSOCIATION_COOKIE, normalizeCode } from "@/lib/association-code";
import { approvedAssociation, attachHousehold } from "@/server/associations";
import { allow, clientIp } from "@/server/rate-limit";
import { getActiveHousehold, getUser } from "@/server/session";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * « Préparer ma semaine » depuis /ecole/[code] : mémorise le code 30 jours (HttpOnly) puis envoie vers la connexion et
 * l'onboarding. Un compte déjà équipé d'un foyer est rattaché tout de suite. Un code non validé ne donne rien.
 */
export async function startWithCode(formData: FormData) {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!allow(`ecole:${await clientIp()}`, 30, 60_000)) redirect(`/ecole/${code}`);
  const association = await approvedAssociation(code);
  if (!association) redirect(`/ecole/${code}`);

  const user = await getUser();
  const household = user ? await getActiveHousehold() : null;
  if (user && household?.role === "admin") {
    const res = await attachHousehold(household.id, association.id, user.id);
    redirect(res.ok ? "/app/abonnement?code=ok" : "/app/abonnement?code=locked");
  }

  (await cookies()).set(ASSOCIATION_COOKIE, association.code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  // Pas encore connecté : droit vers la connexion, qui revient sur l'onboarding.
  redirect(user ? "/onboarding" : `/login?next=${encodeURIComponent("/onboarding")}`);
}
