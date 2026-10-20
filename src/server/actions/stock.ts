"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { loadHouseholdContext } from "@/server/household-context";
import { householdCan } from "@/server/entitlements-load";
import { requireHousehold } from "@/server/session";
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("pantry")
    .select("ingredient_key, qty")
    .eq("household_id", householdId);
  const pantry = Object.fromEntries(
    (data ?? []).map((p) => [p.ingredient_key, p.qty === null ? null : Number(p.qty)]),
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
  const supabase = await createClient();
  const p = parsed.data;
  const { error } =
    p.qty === "remove" || p.qty === 0
      ? await supabase.from("pantry").delete().eq("household_id", household.id).eq("ingredient_key", p.key)
      : await supabase
          .from("pantry")
          .upsert({ household_id: household.id, ingredient_key: p.key, qty: p.qty });
  if (error) return { ok: false, error: toUserMessage(error) };
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
  const supabase = await createClient();
  const { data, error } = await supabase.from("freezer").select("portions").eq("id", id).single();
  if (error) return { ok: false, error: toUserMessage(error) };
  const next = data.portions + delta;
  const res =
    next <= 0
      ? await supabase.from("freezer").delete().eq("id", id)
      : await supabase.from("freezer").update({ portions: next }).eq("id", id);
  if (res.error) return { ok: false, error: toUserMessage(res.error) };
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("freezer")
    .insert({ household_id: household.id, recipe_id: recipeId, portions });
  if (error) return { ok: false, error: toUserMessage(error) };
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
