import "server-only";
import { sql } from "kysely";
import type { SuggestionStatus } from "@/lib/recipe-suggestions";
import { withAdmin } from "@/server/db";

/** Back-office : suggestions de recettes des utilisateurs et catalogue global à corriger. */

/** Suggestions par état (les plus récentes d'abord), avec l'auteur et la recette visée. */
export async function listSuggestions(opts: { status?: SuggestionStatus }) {
  return withAdmin(async (db) => {
    let q = db
      .selectFrom("recipe_suggestions as s")
      .leftJoin("auth.users as u", "u.id", "s.user_id")
      .leftJoin("auth.users as h", "h.id", "s.handled_by")
      .leftJoin("recipes as r", "r.id", "s.recipe_id")
      .select([
        "s.id",
        "s.kind",
        "s.recipe_id",
        "s.recipe_kind",
        "s.title",
        "s.message",
        "s.source_url",
        "s.status",
        "s.note",
        "s.applied_recipe_id",
        "s.handled_at",
        "s.created_at",
        "u.email as email",
        "h.email as handler",
        "r.name as recipe_name",
        "r.kind as target_kind",
      ])
      .orderBy("s.created_at", "desc")
      .limit(200);
    if (opts.status) q = q.where("s.status", "=", opts.status);
    const rows = await q.execute();
    const grouped = await db
      .selectFrom("recipe_suggestions")
      .select(["status", sql<number>`count(*)`.as("n")])
      .groupBy("status")
      .execute();
    const counts: Partial<Record<SuggestionStatus, number>> = {};
    for (const g of grouped) counts[g.status] = Number(g.n);
    return { rows, counts };
  });
}

export async function getSuggestion(id: number) {
  return withAdmin((db) =>
    db
      .selectFrom("recipe_suggestions as s")
      .leftJoin("auth.users as u", "u.id", "s.user_id")
      .select([
        "s.id",
        "s.kind",
        "s.recipe_id",
        "s.recipe_kind",
        "s.title",
        "s.message",
        "s.source_url",
        "s.status",
        "u.email as email",
      ])
      .where("s.id", "=", id)
      .executeTakeFirst(),
  );
}

/** Recette du catalogue global (hors recettes des foyers). */
export async function getCatalogRecipe(id: string) {
  return withAdmin((db) =>
    db
      .selectFrom("recipes")
      .select(["id", "kind", "data", "name", "is_active", "edited_in_admin_at"])
      .where("id", "=", id)
      .where("household_id", "is", null)
      .executeTakeFirst(),
  );
}

/** Clés des ingrédients du catalogue global, avec leur libellé et leur unité (aide à la saisie). */
export async function catalogIngredients() {
  return withAdmin((db) =>
    db.selectFrom("ingredients").select(["key", "label", "unit"]).orderBy("label").execute(),
  );
}

/** Bibliothèque : recherche par nom ou identifiant dans le catalogue global. */
export async function searchCatalog(opts: { q?: string; kind?: string; edited?: boolean }) {
  return withAdmin(async (db) => {
    let q = db
      .selectFrom("recipes")
      .select(["id", "kind", "name", "is_active", "edited_in_admin_at"])
      .where("household_id", "is", null)
      .where("kind", "!=", "breakfast")
      .orderBy("name")
      .limit(100);
    if (opts.q) {
      const like = `%${opts.q.toLowerCase()}%`;
      q = q.where((eb) =>
        eb.or([eb(sql<string>`lower(name)`, "like", like), eb(sql<string>`lower(id)`, "like", like)]),
      );
    }
    if (opts.kind) q = q.where("kind", "=", opts.kind as "main");
    if (opts.edited) q = q.where("edited_in_admin_at", "is not", null);
    return q.execute();
  });
}
