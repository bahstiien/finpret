"use server";

import { sql } from "kysely";
import { fr } from "@/i18n/fr";
import { type SuggestionInput, SUGGESTIONS_PER_DAY, suggestionSchema } from "@/lib/recipe-suggestions";
import { CONTACT_EMAIL } from "@/lib/tuto";
import { withAdmin } from "@/server/db";
import { sendContactMessage } from "@/server/emails";
import type { ActionResult } from "@/server/errors";
import { requireHousehold } from "@/server/session";

const t = fr.suggest;

/**
 * Suggestion d'un utilisateur (Découvrir) : modification d'une recette de la bibliothèque ou nouvelle recette.
 * Enregistrée pour le back-office (/admin/recettes), où elle s'applique au catalogue, et signalée par e-mail à l'équipe.
 * La table n'est pas ouverte aux clients : la session est vérifiée ici, l'écriture passe par `service_role`.
 */
export async function sendRecipeSuggestion(
  input: SuggestionInput,
): Promise<ActionResult<{ message: string }>> {
  const { user, household } = await requireHousehold("/app/discover");
  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.invalid };
  const v = parsed.data;

  const result = await withAdmin(async (db) => {
    const recent = await db
      .selectFrom("recipe_suggestions")
      .select(sql<number>`count(*)`.as("n"))
      .where("user_id", "=", user.id)
      .where("created_at", ">", sql<string>`now() - interval '1 day'`)
      .executeTakeFirst();
    if (Number(recent?.n ?? 0) >= SUGGESTIONS_PER_DAY) return { ok: false as const, error: t.tooMany };

    let title: string;
    if (v.kind === "edit") {
      // Seules les recettes du catalogue global se corrigent ici ; celles du foyer se modifient directement.
      const recipe = await db
        .selectFrom("recipes")
        .select("name")
        .where("id", "=", v.recipeId)
        .where("household_id", "is", null)
        .executeTakeFirst();
      if (!recipe) return { ok: false as const, error: t.unknownRecipe };
      title = (recipe.name ?? v.recipeId).slice(0, 120);
    } else title = v.title;

    const row = await db
      .insertInto("recipe_suggestions")
      .values({
        kind: v.kind,
        recipe_id: v.kind === "edit" ? v.recipeId : null,
        recipe_kind: v.kind === "new" ? v.recipeKind : null,
        title,
        message: v.message,
        source_url: v.kind === "new" ? v.sourceUrl : null,
        user_id: user.id,
        household_id: household.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return { ok: true as const, id: row.id, title };
  }).catch((error: unknown) => {
    console.error("[suggestion] enregistrement impossible", error);
    return { ok: false as const, error: fr.errors.generic };
  });
  if (!result.ok) return { ok: false, error: result.error };

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const sent = await sendContactMessage(process.env.CONTACT_EMAIL ?? CONTACT_EMAIL, {
    name: user.email,
    email: user.email,
    audience: fr.contact.family,
    subject: `${v.kind === "edit" ? "Modification suggérée" : "Nouvelle recette proposée"} : ${result.title}`,
    message: v.message,
    details: [
      ...(v.kind === "new" && v.sourceUrl ? [`Lien : ${v.sourceUrl}`] : []),
      `À traiter dans le back-office : ${appUrl}/admin/recettes#suggestion-${result.id}`,
    ],
  }).catch(() => ({ ok: false as const, reason: "failed" as const }));
  if (!sent.ok && process.env.NODE_ENV !== "production")
    console.info(`[suggestion] ${user.email} · ${result.title}\n${v.message}`);

  return { ok: true, data: { message: t.sent } };
}
