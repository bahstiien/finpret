"use server";

import { APIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { ASSOCIATION_COOKIE, normalizeCode } from "@/lib/association-code";
import { FEATURES } from "@/lib/features";
import { safeNext } from "@/lib/redirect";
import { notificationsSchema } from "@/lib/settings";
import { auth } from "@/server/auth";
import { approvedAssociation } from "@/server/associations";
import { json, withAdmin } from "@/server/db";
import { allow, clientIp } from "@/server/rate-limit";

export type LoginState =
  { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const emailSchema = z.object({
  email: z.email().max(254),
  next: z.string().optional(),
});

/** Résultat des formulaires à mot de passe : `verify` quand un lien de confirmation vient de partir. */
export type PasswordState =
  | { status: "idle" }
  | { status: "error"; message: string; title?: string; fields?: { name?: string; email?: string } }
  | { status: "verify"; email: string }
  | { status: "sent"; email: string }
  | { status: "done" };

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));
const passwordField = z.string().min(8).max(128);

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(128),
  remember: z.string().optional(),
  next: z.string().optional(),
});

/** Connexion par e-mail et mot de passe ; sans la case « Se souvenir de moi », la session s'arrête avec le navigateur. */
export async function signInWithPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { status: "error", title: fr.login.badCredentialsTitle, message: fr.login.badCredentials };
  const { email, password, remember } = parsed.data;
  const fields = { email };

  // 10 essais par quart d'heure et par adresse, et par adresse IP : freine la devinette de mots de passe.
  const ip = await clientIp();
  if (!allow(`pwlogin:${email}`, 10, 900_000) || !allow(`pwlogin-ip:${ip}`, 30, 900_000))
    return { status: "error", message: fr.login.tooManyAttempts, fields };

  const next = safeNext(parsed.data.next ?? "/app");
  try {
    await auth().api.signInEmail({
      body: { email, password, rememberMe: remember === "on", callbackURL: next },
      headers: await headers(),
    });
  } catch (e) {
    // 403 : adresse pas encore confirmée (Better Auth renvoie alors le lien de confirmation).
    if (e instanceof APIError && e.statusCode === 403)
      return { status: "error", message: fr.login.notVerified, fields };
    return { status: "error", title: fr.login.badCredentialsTitle, message: fr.login.badCredentials, fields };
  }
  redirect(next);
}

const signupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: emailField,
  password: passwordField,
  code: z.string().optional(),
  news: z.string().optional(),
  next: z.string().optional(),
});

/** Inscription par e-mail et mot de passe : le compte s'ouvre une fois l'adresse confirmée par le lien reçu. */
export async function signUpWithPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((i) => i.path[0]));
    return {
      status: "error",
      message: fields.has("name")
        ? fr.login.invalidName
        : fields.has("email")
          ? fr.login.invalidEmail
          : fr.login.passwordTooShort,
    };
  }
  const { name, email, password, news } = parsed.data;
  const fields = { name, email };
  if (!allow(`signup-ip:${await clientIp()}`, 10, 3_600_000))
    return { status: "error", message: fr.login.tooManyAttempts, fields };

  // Un code saisi doit désigner une association approuvée : sinon on le dit, plutôt que de l'ignorer en silence.
  const code = normalizeCode(parsed.data.code ?? "");
  const association = code ? await approvedAssociation(code) : null;
  if (code && !association) return { status: "error", message: fr.login.codeUnknown, fields };

  const next = safeNext(parsed.data.next ?? "/onboarding", "/onboarding");
  try {
    const res = await auth().api.signUpEmail({
      body: { name, email, password, callbackURL: next },
      headers: await headers(),
    });
    // La case est cochée par défaut dans les préférences : décochée, on enregistre le refus.
    if (news !== "on" && res.user?.id) await disableMarketingEmails(res.user.id);
  } catch {
    return { status: "error", message: fr.login.signupFailed, fields };
  }
  if (association) {
    (await cookies()).set(ASSOCIATION_COOKIE, association.code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return { status: "verify", email };
}

async function disableMarketingEmails(userId: string) {
  await withAdmin(async (db) => {
    const row = await db
      .selectFrom("user_settings")
      .select("notifications")
      .where("user_id", "=", userId)
      .executeTakeFirst();
    const prefs = notificationsSchema.parse(row?.notifications ?? {});
    await db
      .updateTable("user_settings")
      .set({ notifications: json({ ...prefs, marketingEmails: false }) })
      .where("user_id", "=", userId)
      .execute();
  });
}

const forgotSchema = z.object({ email: emailField });

/** Demande de réinitialisation : la réponse est la même que l'adresse ait un compte ou non. */
export async function requestPasswordReset(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: fr.login.invalidEmail };
  const { email } = parsed.data;
  if (!allow(`reset:${email}`, 5, 3_600_000)) return { status: "error", message: fr.login.tooMany };
  try {
    await auth().api.requestPasswordReset({
      body: { email, redirectTo: "/login/nouveau" },
      headers: await headers(),
    });
  } catch {
    return { status: "error", message: fr.login.failed };
  }
  return { status: "sent", email };
}

const resetSchema = z.object({ token: z.string().min(1).max(512), password: passwordField });

/** Nouveau mot de passe, avec le jeton du lien reçu par e-mail. */
export async function resetPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: fr.login.passwordTooShort };
  try {
    await auth().api.resetPassword({ body: { newPassword: parsed.data.password, token: parsed.data.token } });
  } catch {
    return { status: "error", message: fr.login.resetInvalid };
  }
  return { status: "done" };
}

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
