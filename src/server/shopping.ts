import "server-only";
import type { Env } from "@/engine/env";
import { guessAisle, shoppingList } from "@/engine/shopping";
import type { WeekPlan } from "@/engine/types";
import { createClient } from "@/lib/supabase/server";
import { type HouseholdContext, portionModelFor } from "./household-context";

/**
 * Met la liste de courses d'une semaine en accord avec son menu (§8.3), article par article :
 * quantités mises à jour, nouveaux articles ajoutés, articles devenus inutiles retirés. Les coches et les
 * articles ajoutés à la main sont conservés. Au premier passage, ajoute les articles récurrents du foyer.
 */
export async function syncShoppingItems(
  ctx: HouseholdContext,
  env: Env,
  week: { id: string; plan: WeekPlan },
) {
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("shopping_items")
    .select("id, source, ingredient_key, qty_text, aisle, label")
    .eq("week_id", week.id);
  if (error) throw error;
  const rows = existing ?? [];
  const baseToBuy = rows.filter((r) => r.source === "pantry_check").map((r) => r.ingredient_key!);
  const { items, baseUsed } = shoppingList(
    env,
    week.plan,
    portionModelFor(ctx, week.plan.start),
    ctx.pantry,
    ctx.settings.menu.cake.enabled,
    baseToBuy,
  );

  const menuRows = new Map(rows.filter((r) => r.source === "menu").map((r) => [r.ingredient_key!, r]));
  const wanted = items.filter((i) => !baseToBuy.includes(i.key));
  const inserts = wanted
    .filter((i) => !menuRows.has(i.key))
    .map((i) => ({
      household_id: ctx.id,
      week_id: week.id,
      source: "menu" as const,
      ingredient_key: i.key,
      qty_text: i.qty,
      aisle: i.aisle,
    }));
  const updates = wanted.filter((i) => {
    const r = menuRows.get(i.key);
    return r && (r.qty_text !== i.qty || r.aisle !== i.aisle);
  });
  const removed = [...menuRows.keys()].filter((k) => !wanted.some((i) => i.key === k));

  if (inserts.length) {
    const { error: e } = await supabase.from("shopping_items").insert(inserts);
    if (e) throw e;
  }
  for (const i of updates) {
    await supabase
      .from("shopping_items")
      .update({ qty_text: i.qty, aisle: i.aisle })
      .eq("id", menuRows.get(i.key)!.id);
  }
  if (removed.length) {
    await supabase
      .from("shopping_items")
      .delete()
      .in(
        "id",
        removed.map((k) => menuRows.get(k)!.id),
      );
  }
  // Placard coché « à acheter » : quantité à jour, et retiré si le menu n'en utilise plus.
  for (const r of rows.filter((x) => x.source === "pantry_check")) {
    const used = baseUsed.find((b) => b.key === r.ingredient_key);
    if (!used) await supabase.from("shopping_items").delete().eq("id", r.id);
    else if (used.qty !== r.qty_text)
      await supabase.from("shopping_items").update({ qty_text: used.qty }).eq("id", r.id);
  }

  if (rows.length === 0 && ctx.settings.shopping.recurring.length) {
    await supabase.from("shopping_items").insert(
      ctx.settings.shopping.recurring.map((label) => ({
        household_id: ctx.id,
        week_id: week.id,
        source: "manual" as const,
        label,
        aisle: guessAisle(label),
      })),
    );
  }
  return { baseUsed };
}
