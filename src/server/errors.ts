import { fr } from "@/i18n/fr";

/** Codes métier levés par les fonctions SQL (`raise exception 'last_admin'`…). */
const KNOWN = [
  "last_admin",
  "too_many_households",
  "invitation_not_found",
  "invitation_expired",
  "invitation_used",
  "too_many_editors",
  "too_many_associations",
  "code_already_changed",
  "association_locked",
] as const;

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Traduit une erreur Postgres (levée par `pg`, attrapée dans un `catch`) en message pour l'utilisateur. */
export function toUserMessage(caught: unknown): string {
  if (!caught || typeof caught !== "object") return fr.errors.generic;
  const error = caught as { code?: unknown; message?: unknown };
  const known = KNOWN.find((k) => error.message === k);
  if (known) return fr.errors[known];
  // 42501 : refus par la RLS ou par les droits sur la table.
  if (error.code === "42501") return fr.errors.forbidden;
  return fr.errors.generic;
}
