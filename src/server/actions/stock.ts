"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { loadHouseholdContext } from "@/server/household-context";
import { householdCan } from "@/server/entitlements-load";
import { requireHousehold, withSession } from "@/server/session";
import { syncShoppingItems } from "@/server/shopping";
import { applyLeftovers, bankDoubles, currentAndNext, engineEnvFor } from "@/server/weeks";

/** Actions de l'onglet Stock (§8.4). Chaque changement du garde-manger recalcule la liste de courses. */

const t = fr.stock;
type Result = ActionResult<{ message: string }>;

async function editor() {
  const { household } = await requireHousehold("/app/stock");
  if (household.role === "viewer") return null;
  return household;
}

/** Recalcule la liste de courses de la semaine préparée (ou en cours) après un changement de stock. */
async function resyncShopping(householdId: string) {
  const ctx = await loadHouseholdContext(householdId);
  const { current, next } = currentAndNext(ctx);
  const week = next ?? current;
  if (!week) return;
  // Le contexte en cache date d'avant la modification : on relit le garde-manger.
  const data = await withSession((db) =>
    db
      .selectFrom("pantry")
      .select(["ingredient_key", "qty"])
      .where("household_id", "=", householdId)
      .execute(),
  );
  const pantry = Object.fromEntries(
    data.map((p) => [p.ingredient_key, p.qty === null ? null : Number(p.qty)]),
  );
  const fresh = { ...ctx, pantry };
  await syncShoppingItems(fresh, await engineEnvFor(fresh), { id: week.id, plan: week.plan });
}

const pantrySchema = z.object({
  key: z.string().min(1).max(40),
  /** Quantité, null pour « assez », ou "remove" pour retirer l'ingrédient du garde-manger. */
  qty: z.union([z.number().min(0).max(100000), z.null(), z.literal("remove")]),
});

export async function setPantry(key: string, qty: number | null | "remove"): Promise<Result> {
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "pantry"))) return { ok: false, error: fr.errors.upgrade };
  const parsed = pantrySchema.safeParse({ key, qty });
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  const p = parsed.data;
  const value = p.qty;
  try {
    await withSession(async (db) => {
      if (value === "remove" || value === 0)
        await db
          .deleteFrom("pantry")
          .where("household_id", "=", household.id)
          .where("ingredient_key", "=", p.key)
          .execute();
      else
        await db
          .insertInto("pantry")
          .values({ household_id: household.id, ingredient_key: p.key, qty: value })
          .onConflict((oc) => oc.columns(["household_id", "ingredient_key"]).doUpdateSet({ qty: value }))
          .execute();
    });
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  await resyncShopping(household.id);
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: p.qty === "remove" || p.qty === 0 ? t.pantryRemoved : t.pantrySaved } };
}

export async function adjustFreezer(id: string, delta: number): Promise<Result> {
  if (!FEATURES.freezerAndLeftovers) return { ok: false, error: fr.errors.forbidden };
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  if (!z.uuid().safeParse(id).success || ![-1, 1].includes(delta))
    return { ok: false, error: fr.errors.generic };
  let next: number;
  try {
    next = await withSession(async (db) => {
      const data = await db
        .selectFrom("freezer")
        .select("portions")
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
      const n = data.portions + delta;
      if (n <= 0) await db.deleteFrom("freezer").where("id", "=", id).execute();
      else await db.updateTable("freezer").set({ portions: n }).where("id", "=", id).execute();
      return n;
    });
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: next <= 0 ? t.freezerEmptied : t.freezerSaved(next) } };
}

export async function addToFreezer(recipeId: string, portions: number): Promise<Result> {
  if (!FEATURES.freezerAndLeftovers) return { ok: false, error: fr.errors.forbidden };
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  if (!recipeId || !Number.isInteger(portions) || portions < 1 || portions > 20) {
    return { ok: false, error: fr.errors.generic };
  }
  try {
    await withSession((db) =>
      db
        .insertInto("freezer")
        .values({ household_id: household.id, recipe_id: recipeId, portions })
        .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: t.freezerAdded(portions) } };
}

/** « Mettre à jour le garde-manger » après la session : restes des contenants ajoutés, épuisés retirés. */
export async function updatePantryAfterSession(weekId: string): Promise<Result> {
  if (!FEATURES.freezerAndLeftovers) return { ok: false, error: fr.errors.forbidden };
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  const ctx = await loadHouseholdContext(household.id);
  const row = ctx.weeks.find((w) => w.id === weekId);
  if (!row) return { ok: false, error: fr.menuActions.weekGone };
  if (row.pantry_done) return { ok: true, data: { message: t.alreadyUpdated } };
  const changes = await applyLeftovers(ctx, await engineEnvFor(ctx), row);
  await resyncShopping(household.id);
  revalidatePath("/app", "layout");
  const kept = changes.filter((c) => c.after > 0).length;
  return { ok: true, data: { message: t.updated(kept, changes.length - kept) } };
}

/** Ranger les plats doublés dans la réserve du congélateur (dernière étape de la session). */
export async function bankDoublesAction(weekId: string): Promise<Result> {
  if (!FEATURES.freezerAndLeftovers) return { ok: false, error: fr.errors.forbidden };
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  const ctx = await loadHouseholdContext(household.id);
  const row = ctx.weeks.find((w) => w.id === weekId);
  if (!row) return { ok: false, error: fr.menuActions.weekGone };
  const n = await bankDoubles(ctx, row);
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: t.banked(n) } };
}
