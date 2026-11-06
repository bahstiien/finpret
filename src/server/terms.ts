import "server-only";
import { TERMS_VERSION } from "@/lib/legal";
import { withAdmin } from "@/server/db";

/** Preuve d'acceptation des CGU : date et version (la ligne `user_settings` est créée avec le compte). */
export async function recordTermsAcceptance(userId: string) {
  await withAdmin((db) =>
    db
      .updateTable("user_settings")
      .set({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
      .where("user_id", "=", userId)
      .execute(),
  );
}

/** Vrai si le compte a déjà accepté les CGU (inscription par mot de passe ou écran d'accord à l'onboarding). */
export async function hasAcceptedTerms(userId: string): Promise<boolean> {
  const row = await withAdmin((db) =>
    db.selectFrom("user_settings").select("terms_accepted_at").where("user_id", "=", userId).executeTakeFirst(),
  );
  return !!row?.terms_accepted_at;
}
