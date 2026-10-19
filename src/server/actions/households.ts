"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { ACTIVE_HOUSEHOLD_COOKIE, getHouseholds, requireUser } from "@/server/session";

const ONE_YEAR = 60 * 60 * 24 * 365;
const uuid = z.uuid();
const role = z.enum(["admin", "member", "viewer"]);

async function rememberOnDevice(householdId: string) {
  (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export type FormState = { error?: string };

export async function createHousehold(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/onboarding");
  const parsed = z
    .string()
    .trim()
    .min(1)
    .max(60)
    .safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { error: fr.household.nameInvalid };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_household", { p_name: parsed.data });
  if (error) return { error: toUserMessage(error) };
  await rememberOnDevice(data);
  // TODO(M4) : enchaîner sur l'assistant d'onboarding complet (§5).
  redirect("/app");
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  await requireUser(`/join/${token}`);
  const parsed = z
    .string()
    .regex(/^[0-9a-f]{48}$/)
    .safeParse(token);
  if (!parsed.success) return { ok: false, error: fr.errors.invitation_not_found };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: parsed.data });
  if (error) return { ok: false, error: toUserMessage(error) };
  await rememberOnDevice(data);
  redirect("/app");
}

export async function switchHousehold(formData: FormData) {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("householdId"));
  if (!id.success) return;
  const households = await getHouseholds();
  if (!households.some((h) => h.id === id.data)) return;
  await rememberOnDevice(id.data);
  const supabase = await createClient();
  await supabase.from("profiles").update({ active_household: id.data }).eq("user_id", user.id);
  revalidatePath("/", "layout");
}

const inviteSchema = z.object({
  householdId: uuid,
  role,
  email: z.union([z.literal(""), z.email().max(254)]).transform((v) => v || null),
});

export type InviteState = { error?: string; token?: string };

export async function createInvitation(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireUser("/settings/household");
  const parsed = inviteSchema.safeParse({
    householdId: formData.get("householdId"),
    role: formData.get("role"),
    email: String(formData.get("email") ?? "").trim(),
  });
  if (!parsed.success) return { error: fr.errors.generic };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .insert({ household_id: parsed.data.householdId, role: parsed.data.role, email: parsed.data.email })
    .select("token")
    .single();
  if (error) return { error: toUserMessage(error) };
  // TODO(M9) : envoi de l'invitation par e-mail quand le fournisseur d'e-mails sera branché.
  revalidatePath("/settings/household");
  return { token: data.token };
}

export async function revokeInvitation(formData: FormData): Promise<ActionResult> {
  await requireUser("/settings/household");
  const id = uuid.safeParse(formData.get("invitationId"));
  if (!id.success) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", id.data);
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/settings/household");
  return { ok: true, data: undefined };
}

const memberSchema = z.object({ householdId: uuid, userId: uuid });

export async function changeRole(formData: FormData): Promise<ActionResult> {
  await requireUser("/settings/household");
  const parsed = memberSchema.extend({ role }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({ role: parsed.data.role })
    .eq("household_id", parsed.data.householdId)
    .eq("user_id", parsed.data.userId)
    .select("role");
  if (error) return { ok: false, error: toUserMessage(error) };
  if (!data?.length) return { ok: false, error: fr.errors.forbidden };
  revalidatePath("/settings/household");
  return { ok: true, data: undefined };
}

export async function removeAccount(formData: FormData): Promise<ActionResult> {
  await requireUser("/settings/household");
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .delete()
    .eq("household_id", parsed.data.householdId)
    .eq("user_id", parsed.data.userId)
    .select("user_id");
  if (error) return { ok: false, error: toUserMessage(error) };
  if (!data?.length) return { ok: false, error: fr.errors.forbidden };
  revalidatePath("/settings/household");
  return { ok: true, data: undefined };
}

export async function leaveHousehold(formData: FormData): Promise<ActionResult> {
  await requireUser("/settings/household");
  const id = uuid.safeParse(formData.get("householdId"));
  if (!id.success) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_household", { p_household: id.data });
  if (error) return { ok: false, error: toUserMessage(error) };
  (await cookies()).delete(ACTIVE_HOUSEHOLD_COOKIE);
  redirect("/app");
}
