import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/session";

/** Compte administrateur déjà connu mais sans second facteur validé (page d'activation TOTP). */
export async function requireAdminIdentity() {
  const user = await requireUser("/admin");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  // Le back-office n'existe pas pour les autres comptes.
  if (!isAdmin) notFound();
  return { user, supabase };
}

/**
 * Accès au back-office (SPEC_JANVIER §8) : compte présent dans `admins` ET second facteur TOTP validé pour cette
 * session (niveau d'assurance aal2). Sinon, activation ou saisie du code sur /admin/mfa.
 */
export async function requireAdmin() {
  const { user, supabase } = await requireAdminIdentity();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel !== "aal2") redirect("/admin/mfa");
  return { user, db: createAdminClient() };
}

/** Toute action d'écriture du back-office est journalisée dans `admin_audit`. */
export async function audit(
  adminId: string,
  action: string,
  target: string | null,
  props: Record<string, Json> = {},
) {
  await createAdminClient().from("admin_audit").insert({ admin_id: adminId, action, target, props });
}
