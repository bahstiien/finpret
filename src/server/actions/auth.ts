"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const emailSchema = z.object({
  email: z.email().max(254),
  next: z.string().optional(),
});

async function siteOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

/** Lien magique par e-mail (Supabase OTP). */
export async function signInWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: fr.login.invalidEmail };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl(await siteOrigin(), parsed.data.next ?? "/app") },
  });
  if (error) return { status: "error", message: fr.login.failed };
  return { status: "sent", email: parsed.data.email };
}

const oauthSchema = z.object({ provider: z.enum(["apple", "google"]), next: z.string().optional() });

/** Connexion Apple ou Google (OAuth). */
export async function signInWithProvider(formData: FormData) {
  const parsed = oauthSchema.safeParse({
    provider: formData.get("provider"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) redirect("/login?error=provider");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data.provider,
    options: { redirectTo: callbackUrl(await siteOrigin(), parsed.data.next ?? "/app") },
  });
  if (error || !data.url) redirect("/login?error=provider");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
