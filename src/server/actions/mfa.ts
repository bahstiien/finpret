"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminIdentity } from "@/server/admin";
import { verifyMfa } from "@/server/mfa";

export type MfaState = { error?: string };

const codeSchema = z.string().regex(/^\d{6}$/);

/** Saisie du code TOTP sur /admin/mfa : ouvre le back-office pour la session courante. */
export async function submitMfaCode(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const { user, sessionId } = await requireAdminIdentity();
  const code = codeSchema.safeParse(String(formData.get("code") ?? "").trim());
  if (!code.success) return { error: "Saisissez les 6 chiffres du code." };
  const result = await verifyMfa(user.id, sessionId, code.data);
  if (result === "locked") return { error: "Trop d'essais. Réessayez dans 10 minutes." };
  if (result === "invalid") return { error: "Code incorrect." };
  redirect("/admin");
}
