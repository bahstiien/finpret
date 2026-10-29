"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { safeNext } from "@/lib/redirect";
import { auth } from "@/server/auth";
import { allow } from "@/server/rate-limit";

export type LoginState =
  { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const emailSchema = z.object({
  email: z.email().max(254),
  next: z.string().optional(),
});

/** En cas d'échec, Better Auth revient sur cette page avec `?error=…` (lien expiré, refus du fournisseur). */
const errorUrl = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/** Lien magique par e-mail (Better Auth). */
export async function signInWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: fr.login.invalidEmail };

  // 5 liens par heure et par adresse (SPEC_JANVIER §8) : freine l'envoi en rafale.
  if (!allow(`login:${parsed.data.email}`, 5, 3_600_000))
    return { status: "error", message: fr.login.tooMany };
  const next = safeNext(parsed.data.next ?? "/app");
  try {
    await auth().api.signInMagicLink({
      body: { email: parsed.data.email, callbackURL: next, errorCallbackURL: errorUrl(next) },
      headers: await headers(),
    });
  } catch {
    return { status: "error", message: fr.login.failed };
  }
  return { status: "sent", email: parsed.data.email };
}

const oauthSchema = z.object({
  provider: z.enum(["apple", "google"]).refine((p) => FEATURES.appleSignIn || p !== "apple"),
  next: z.string().optional(),
});

/** Connexion Apple ou Google (OAuth). */
export async function signInWithProvider(formData: FormData) {
  const parsed = oauthSchema.safeParse({
    provider: formData.get("provider"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) redirect("/login?error=provider");

  const next = safeNext(parsed.data.next ?? "/app");
  const result = await auth()
    .api.signInSocial({
      body: { provider: parsed.data.provider, callbackURL: next, errorCallbackURL: errorUrl(next) },
      headers: await headers(),
    })
    .catch(() => null);
  if (!result?.url) redirect("/login?error=provider");
  redirect(result.url);
}

export async function signOut() {
  await auth().api.signOut({ headers: await headers() });
  redirect("/");
}
