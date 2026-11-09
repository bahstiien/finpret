"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkCatalogRecipe, EDITABLE_KINDS } from "@/engine/catalog/admin-recipe";
import { fr } from "@/i18n/fr";
import { SUGGESTION_STATUSES } from "@/lib/recipe-suggestions";
import { audit, requireOwner } from "@/server/admin";
import { json, withAdmin } from "@/server/db";
import type { ActionResult } from "@/server/errors";

/** Back-office : traitement des suggestions de recettes et écriture du catalogue global. */

const suggestionId = z.coerce.number().int().positive();

const done = (...paths: string[]) => {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/admin", "layout");
};

/** Refuse une suggestion, ou la remet à traiter. */
export async function setSuggestionStatus(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = suggestionId.safeParse(formData.get("id"));
  const status = z.enum(SUGGESTION_STATUSES).safeParse(formData.get("status"));
  if (!id.success || !status.success) return { ok: false, error: fr.errors.generic };
  const open = status.data === "new";
  await withAdmin((db) =>
    db
      .updateTable("recipe_suggestions")
      .set({
        status: status.data,
        handled_by: open ? null : user.id,
        handled_at: open ? null : new Date().toISOString(),
        ...(open && { applied_recipe_id: null }),
      })
      .where("id", "=", id.data)
      .execute(),
  );
  await audit(user.id, "recipe_suggestion.status", String(id.data), { status: status.data });
  done("/admin/recettes");
  return { ok: true, data: undefined };
}

/** Note interne (ce qui a été changé, pourquoi la suggestion est refusée). */
export async function setSuggestionNote(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = suggestionId.safeParse(formData.get("id"));
  const note = z
    .string()
    .trim()
    .max(2000)
    .safeParse(formData.get("note") ?? "");
  if (!id.success || !note.success) return { ok: false, error: fr.errors.generic };
  await withAdmin((db) =>
    db
      .updateTable("recipe_suggestions")
      .set({ note: note.data || null })
      .where("id", "=", id.data)
      .execute(),
  );
  await audit(user.id, "recipe_suggestion.note", String(id.data));
  done("/admin/recettes");
  return { ok: true, data: undefined };
}

const saveSchema = z.object({
  mode: z.enum(["edit", "new"]),
  kind: z.enum(EDITABLE_KINDS),
  id: z.string().trim().min(1).max(80),
  data: z.string().min(2).max(100_000),
  active: z.enum(["on"]).optional(),
  suggestion: z.union([z.literal(""), suggestionId]).optional(),
});

/**
 * Enregistre une recette du catalogue global : modification d'une recette existante ou ajout à la bibliothèque.
 * Mêmes contrôles que le seed (forme, ingrédients connus, placeholders, protéine) ; régime et allergènes déduits.
 * La recette est marquée `edited_in_admin_at` pour que `pnpm seed` ne l'écrase pas. Si elle vient d'une
 * suggestion, celle-ci passe à l'état « appliquée ».
 */
export async function saveCatalogRecipe(
  formData: FormData,
): Promise<ActionResult<{ id: string; issues?: string[] }>> {
  const { user } = await requireOwner();
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Formulaire incomplet." };
  const v = parsed.data;

  let data: unknown;
  try {
    data = JSON.parse(v.data);
  } catch (e) {
    return { ok: false, error: `JSON invalide : ${(e as Error).message}` };
  }

  const keys = await withAdmin((db) => db.selectFrom("ingredients").select("key").execute());
  const checked = checkCatalogRecipe(v.kind, v.id, data, new Set(keys.map((k) => k.key)));
  if (!checked.ok) return { ok: false, error: checked.issues.join("\n") };
  const { row } = checked;
  const now = new Date().toISOString();
  const values = {
    kind: row.kind,
    data: json(row.data),
    origin: row.origin,
    protein: row.protein,
    months: row.months,
    diet_tags: row.diet_tags,
    allergens: row.allergens,
    is_active: v.active === "on",
    edited_in_admin_at: now,
  };

  const error = await withAdmin(async (db) => {
    const existing = await db
      .selectFrom("recipes")
      .select(["household_id", "kind"])
      .where("id", "=", row.id)
      .executeTakeFirst();
    if (v.mode === "new") {
      if (existing) return `L'identifiant « ${row.id} » est déjà pris.`;
      await db
        .insertInto("recipes")
        .values({ id: row.id, ...values, status: "validated" })
        .execute();
    } else {
      if (!existing || existing.household_id !== null) return "Recette introuvable dans le catalogue.";
      // Changer de type déplacerait la recette d'un tirage à l'autre dans les semaines déjà générées.
      if (existing.kind !== row.kind) return "Le type d'une recette existante ne se change pas.";
      await db.updateTable("recipes").set(values).where("id", "=", row.id).execute();
    }
    if (v.suggestion)
      await db
        .updateTable("recipe_suggestions")
        .set({ status: "accepted", applied_recipe_id: row.id, handled_by: user.id, handled_at: now })
        .where("id", "=", v.suggestion)
        .execute();
    return null;
  });
  if (error) return { ok: false, error };

  await audit(user.id, v.mode === "new" ? "catalog.recipe_add" : "catalog.recipe_edit", row.id, {
    kind: row.kind,
    active: v.active === "on",
    ...(v.suggestion ? { suggestion: v.suggestion } : {}),
  });
  done("/admin/recettes", "/admin/bibliotheque");
  revalidatePath("/app", "layout");
  return { ok: true, data: { id: row.id } };
}
