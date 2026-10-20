"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/server/errors";
import type { FormState } from "@/server/actions/households";
import { requireUser } from "@/server/session";

const name = z.string().trim().min(1).max(60);

export type SavedState = FormState & { saved?: boolean };

export async function saveProfileName(_prev: SavedState, formData: FormData): Promise<SavedState> {
  const user = await requireUser("/settings/profile");
  const parsed = name.safeParse(formData.get("displayName") ?? "");
  if (!parsed.success) return { error: fr.settingsAccount.displayNameInvalid };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("user_id", user.id);
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function saveHouseholdName(_prev: SavedState, formData: FormData): Promise<SavedState> {
  await requireUser("/settings/household");
  const parsed = z
    .object({ householdId: z.uuid(), name })
    .safeParse({ householdId: formData.get("householdId"), name: formData.get("name") ?? "" });
  if (!parsed.success) return { error: fr.settingsAccount.householdNameInvalid };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("households")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.householdId)
    .select("id");
  if (error) return { error: toUserMessage(error) };
  if (!data?.length) return { error: fr.errors.forbidden };
  revalidatePath("/", "layout");
  return { saved: true };
}
