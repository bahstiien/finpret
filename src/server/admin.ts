import "server-only";
import { notFound, redirect } from "next/navigation";
import { json, rpc, withAdmin } from "@/server/db";
import type { Json } from "@/server/db.types";
import { getAuthSession, requireUser, withSession } from "@/server/session";

/** Compte administrateur, second facteur validé ou non pour cette session (page d'activation TOTP). */
export async function requireAdminIdentity() {
  const user = await requireUser("/admin");
  const isAdmin = await withSession((db) => rpc<boolean>(db, "is_admin"));
  // Le back-office n'existe pas pour les autres comptes.
  if (!isAdmin) notFound();
  const session = (await getAuthSession())!.session;
  const row = await withAdmin((db) =>
    db.selectFrom("admins").select("role").where("user_id", "=", user.id).executeTakeFirst(),
  );
  return {
    user,
    sessionId: session.id,
    mfaVerified: Boolean(session.mfaVerifiedAt),
    role: row?.role ?? ("support" as const),
  };
}

/**
 * Accès au back-office (SPEC_JANVIER §8) : compte présent dans `admins` ET second facteur TOTP validé pour cette
 * session (src/server/mfa.ts). Sinon, activation ou saisie du code sur /admin/mfa.
 */
export async function requireAdmin() {
  const { user, mfaVerified, role } = await requireAdminIdentity();
  if (!mfaVerified) redirect("/admin/mfa");
  return { user, role };
}

/** Action d'écriture du back-office : réservée au rôle `owner` (le rôle `support` consulte seulement). */
export async function requireOwner() {
  const admin = await requireAdmin();
  if (admin.role !== "owner") throw new Error("Action réservée aux administrateurs complets.");
  return admin;
}

/** Toute action d'écriture du back-office est journalisée dans `admin_audit`. */
export async function audit(
  adminId: string,
  action: string,
  target: string | null,
  props: Record<string, Json> = {},
) {
  await withAdmin((db) =>
    db
      .insertInto("admin_audit")
      .values({ admin_id: adminId, action, target, props: json(props) })
      .execute(),
  );
}
