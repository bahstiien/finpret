import "server-only";
import type { Env } from "@/engine/env";
import { removableMenuKeys } from "@/engine/purchases";
import { guessAisle, shoppingList } from "@/engine/shopping";
import { FEATURES } from "@/lib/features";
import type { WeekPlan } from "@/engine/types";
import { createClient } from "@/lib/supabase/server";
import { pantryForWeek } from "./allocations";
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
  // Stock déjà réservé par les semaines précédentes retiré (AC-11) ; une semaine inconnue du contexte garde tout le stock.
  const stockRow = ctx.weeks.find((w) => w.id === week.id);
  const pantry = FEATURES.realPurchases && stockRow ? pantryForWeek(ctx, env, stockRow).pantry : ctx.pantry;
  const { items, baseUsed } = shoppingList(
    env,
    week.plan,
    portionModelFor(ctx, week.plan.start),
    pantry,
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
  // Un achat réel enregistré garde sa ligne : le recalcul ne met à jour que les besoins dérivés.
  let purchased = new Set<string>();
  if (FEATURES.realPurchases) {
    const { data: ev, error: evErr } = await supabase
      .from("purchase_events")
      .select("ingredient_key")
      .eq("week_id", week.id);
    if (evErr) throw evErr;
    purchased = new Set((ev ?? []).map((e) => e.ingredient_key));
  }
  const removed = removableMenuKeys(
    [...menuRows.keys()],
    wanted.map((i) => i.key),
    purchased,
  );

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
