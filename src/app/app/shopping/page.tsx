import type { Metadata } from "next";
import { ShoppingScreen } from "@/components/shopping/ShoppingScreen";
import { Card } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { FEATURES } from "@/lib/features";
import { loadHouseholdContext } from "@/server/household-context";
import { portionModelFor } from "@/server/household-context";
import { pantryForWeek } from "@/server/allocations";
import { loadPurchaseView } from "@/server/purchases-view";
import { requireHousehold } from "@/server/session";
import { syncShoppingItems } from "@/server/shopping";
import { currentAndNext, engineEnvFor } from "@/server/weeks";
import { PageHeader } from "@/components/ui/Layout";

export const metadata: Metadata = { title: fr.nav.shopping };

/** Onglet Courses (§8.3) : la liste de la semaine préparée (ou en cours), partagée en temps réel. */
export default async function ShoppingPage() {
  const { user, household } = await requireHousehold("/app/shopping");
  const ctx = await loadHouseholdContext(household.id);
  const { current, next } = currentAndNext(ctx);
  const week = next ?? current;
  if (!week) {
    return (
      <>
        <PageHeader title={fr.nav.shopping} />
        <Card>
          <p className="text-muted">{fr.shopping.noWeek}</p>
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const env = await engineEnvFor(ctx);
  // Une liste jamais synchronisée (semaine créée avant M6) l'est à la première ouverture.
  const { baseUsed } =
    household.role === "viewer"
      ? { baseUsed: [] }
      : await syncShoppingItems(ctx, env, { id: week.id, plan: week.plan });
  const [{ data: items }, { data: aisles }, { data: memberships }, { data: history }] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("id, source, ingredient_key, label, qty_text, aisle, checked, added_by, updated_at")
      .eq("week_id", week.id),
    supabase.from("aisles").select("key, label, position").order("position"),
    supabase.from("memberships").select("user_id").eq("household_id", household.id),
    supabase
      .from("shopping_items")
      .select("label")
      .eq("household_id", household.id)
      .eq("source", "manual")
      .limit(500),
  ]);
  const ids = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", ids);
  const names: Record<string, string> = {};
  for (const p of profiles ?? []) {
    const member = ctx.members.find((m) => m.userId === p.user_id);
    names[p.user_id] = member?.name ?? p.display_name ?? "";
  }
  const counts = new Map<string, number>();
  for (const h of history ?? []) if (h.label) counts.set(h.label, (counts.get(h.label) ?? 0) + 1);
  const frequent = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label]) => label);

  const allAisles = (aisles ?? []).filter((a) => a.key !== "base");
  const order = [
    ...ctx.settings.shopping.aisleOrder.filter((k) => allAisles.some((a) => a.key === k)),
    ...allAisles.map((a) => a.key).filter((k) => !ctx.settings.shopping.aisleOrder.includes(k)),
  ];
  const labels = Object.fromEntries(
    (items ?? [])
      .filter((i) => i.ingredient_key)
      .map((i) => [i.ingredient_key!, env.lib.ingredients[i.ingredient_key!]?.l ?? i.ingredient_key!]),
  );

  const shared = FEATURES.realPurchases ? pantryForWeek(ctx, env, week) : null;
  const purchases = shared
    ? await loadPurchaseView(
        env,
        { id: week.id, plan: week.plan },
        portionModelFor(ctx, week.plan.start),
        shared.pantry,
        ctx.settings.menu.cake.enabled,
        new Set((items ?? []).filter((i) => i.checked && i.ingredient_key).map((i) => i.ingredient_key!)),
        shared.unverified,
      )
    : null;

  return (
    <ShoppingScreen
      purchases={purchases}
      canWrite={household.role !== "viewer"}
      householdId={household.id}
      weekId={week.id}
      title={fr.shopping.exportTitle(formatShort(week.start_date))}
      userId={user.id}
      initialItems={items ?? []}
      ingredientLabels={labels}
      aisles={order.map((k) => ({ key: k, label: allAisles.find((a) => a.key === k)!.label }))}
      names={names}
      baseUsed={[
        ...baseUsed,
        ...ctx.settings.shopping.baseChecks
          .filter((k) => !baseUsed.some((b) => b.key === k))
          .map((k) => ({ key: k, label: env.lib.ingredients[k]?.l ?? k, qty: "", aisle: "epicerie" })),
      ]}
      frequent={frequent}
      exportFormat={ctx.settings.shopping.exportFormat}
    />
  );
}
