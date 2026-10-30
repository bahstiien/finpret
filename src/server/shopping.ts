import "server-only";
import type { Env } from "@/engine/env";
import { removableMenuKeys } from "@/engine/purchases";
import { guessAisle, shoppingList } from "@/engine/shopping";
import { FEATURES } from "@/lib/features";
import type { WeekPlan } from "@/engine/types";
import { pantryForWeek } from "./allocations";
import { type HouseholdContext, portionModelFor } from "./household-context";
import { withSession } from "./session";

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
  return withSession(async (db) => {
    const rows = await db
      .selectFrom("shopping_items")
      .select(["id", "source", "ingredient_key", "qty_text", "aisle", "label"])
      .where("week_id", "=", week.id)
      .execute();
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
      const ev = await db
        .selectFrom("purchase_events")
        .select("ingredient_key")
        .where("week_id", "=", week.id)
        .execute();
      purchased = new Set(ev.map((e) => e.ingredient_key));
    }
    const removed = removableMenuKeys(
      [...menuRows.keys()],
      wanted.map((i) => i.key),
      purchased,
    );

    if (inserts.length) await db.insertInto("shopping_items").values(inserts).execute();
    for (const i of updates) {
      await db
        .updateTable("shopping_items")
        .set({ qty_text: i.qty, aisle: i.aisle })
        .where("id", "=", menuRows.get(i.key)!.id)
        .execute();
    }
    if (removed.length) {
      await db
        .deleteFrom("shopping_items")
        .where(
          "id",
          "in",
          removed.map((k) => menuRows.get(k)!.id),
        )
        .execute();
    }
    // Placard coché « à acheter » : quantité à jour, et retiré si le menu n'en utilise plus.
    for (const r of rows.filter((x) => x.source === "pantry_check")) {
      const used = baseUsed.find((b) => b.key === r.ingredient_key);
      if (!used) await db.deleteFrom("shopping_items").where("id", "=", r.id).execute();
      else if (used.qty !== r.qty_text)
        await db.updateTable("shopping_items").set({ qty_text: used.qty }).where("id", "=", r.id).execute();
    }

    if (rows.length === 0 && ctx.settings.shopping.recurring.length) {
      await db
        .insertInto("shopping_items")
        .values(
          ctx.settings.shopping.recurring.map((label) => ({
            household_id: ctx.id,
            week_id: week.id,
            source: "manual" as const,
            label,
            aisle: guessAisle(label),
          })),
        )
        .execute();
    }
    return { baseUsed };
  });
}
