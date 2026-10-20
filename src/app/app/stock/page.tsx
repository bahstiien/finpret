import type { Metadata } from "next";
import { StockScreen } from "@/components/stock/StockScreen";
import { fmtQ, fmtRaw } from "@/engine/format";
import { totals } from "@/engine/quantities";
import { frozenTooLong, pantryStep, weeksSince } from "@/engine/stock";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { flagOf } from "@/server/menu-view";
import { UpgradeCard } from "@/components/ui/UpgradeCard";
import { householdCan } from "@/server/entitlements-load";
import { requireHousehold } from "@/server/session";
import { currentAndNext, engineEnvFor } from "@/server/weeks";

export const metadata: Metadata = { title: fr.nav.stock };

/** Onglet Stock (§8.4) : réserve du congélateur et garde-manger. */
export default async function StockPage() {
  const { household } = await requireHousehold("/app/stock");
  if (!(await householdCan(household.id, "pantry"))) return <UpgradeCard />;
  const ctx = await loadHouseholdContext(household.id);
  const env = await engineEnvFor(ctx);
  const { today, current, next } = currentAndNext(ctx);
  const week = next ?? current;
  const used = week
    ? totals(env, week.plan, portionModelFor(ctx, week.plan.start), ctx.settings.menu.cake.enabled)
    : {};
  const lib = env.lib;

  const supabase = await createClient();
  const { data: freezerRows } = await supabase
    .from("freezer")
    .select("id, recipe_id, portions, frozen_at")
    .eq("household_id", household.id)
    .order("frozen_at");
  const recipeOf = (id: string) => env.mainById.get(id) ?? env.soupById.get(id) ?? null;
  const freezer = (freezerRows ?? []).map((f) => {
    const r = recipeOf(f.recipe_id);
    return {
      id: f.id,
      name: r?.s ?? f.recipe_id,
      flag: flagOf(r?.o),
      portions: f.portions,
      frozenAt: formatShort(f.frozen_at),
      tooLong: frozenTooLong(f.frozen_at, today),
      weeks: weeksSince(f.frozen_at, today),
    };
  });

  const qtyText = (k: string, q: number) => {
    const u = lib.ingredients[k]?.u;
    return u === "g" || u === "ml" ? fmtRaw(lib, k, q) : fmtQ(lib, k, q);
  };
  const pantry = Object.entries(ctx.pantry)
    .filter(([k]) => lib.ingredients[k])
    .map(([k, qty]) => {
      const g = lib.ingredients[k]!;
      const need = used[k] ?? 0;
      return {
        key: k,
        label: g.l,
        unit: g.u,
        qty,
        step: pantryStep(g, qty ?? 0),
        display: qty === null ? fr.stock.enough : qtyText(k, qty),
        usedText: need ? qtyText(k, need) : null,
        missingText: need && qty !== null && qty < need ? qtyText(k, need - qty) : null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  const freezable = [...env.lib.mains.filter((r) => r.freeze), ...env.lib.soups.filter((r) => r.freeze)]
    .map((r) => ({ id: r.id, name: r.n }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <StockScreen
      canEdit={household.role !== "viewer"}
      freezer={freezer}
      pantry={pantry}
      ingredients={Object.entries(lib.ingredients)
        .filter(([k]) => !(k in ctx.pantry))
        .map(([key, g]) => ({ key, label: g.l }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr"))}
      freezable={freezable}
      week={
        week
          ? {
              id: week.id,
              start: formatShort(week.start_date),
              pantryDone: week.pantry_done,
              doublesToBank: !week.plan.banked && (week.plan.doubles ?? []).length > 0,
            }
          : null
      }
    />
  );
}
