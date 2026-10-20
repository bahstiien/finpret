import type { Metadata } from "next";
import { DiscoverScreen, type DiscoverRecipe } from "@/components/discover/DiscoverScreen";
import { ALLERGENS } from "@/engine/catalog/allergens";
import type { Protein } from "@/engine/catalog/schema";
import { allIngredientKeys, breakfastId, dietTags, recipeAllergens } from "@/engine/catalog/derive";
import { monthOf, weekRecipeIds } from "@/engine/compose";
import { createEnv, dietAllows } from "@/engine/env";
import { fill, fmtQ } from "@/engine/format";
import { originOf } from "@/engine/origins";
import { eligible } from "@/engine/season";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { toDietRules } from "@/lib/settings";
import { loadLibrary } from "@/server/catalog";
import { loadHouseholdContext } from "@/server/household-context";
import { flagOf } from "@/server/menu-view";
import { requireHousehold } from "@/server/session";
import { currentAndNext } from "@/server/weeks";

export const metadata: Metadata = { title: fr.nav.discover };

/** Onglet Découvrir (§8.2) : tout le catalogue, filtré par défaut selon le régime et les allergènes du foyer. */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const { household } = await requireHousehold("/app/discover");
  const ctx = await loadHouseholdContext(household.id);
  const { lib: full, imported } = await loadLibrary(household.id);
  // Les recettes supprimées par le foyer ne sont plus proposées.
  const retired = new Set(full.retired ?? []);
  const lib = {
    ...full,
    mains: full.mains.filter((r) => !retired.has(r.id)),
    soups: full.soups.filter((r) => !retired.has(r.id)),
    simples: full.simples.filter((r) => !retired.has(r.id)),
    cakes: full.cakes.filter((r) => !retired.has(r.id)),
  };
  const { current, next, today } = currentAndNext(ctx);
  const week = next ?? current;
  const month = monthOf(week?.start_date ?? today);
  // Environnement sans filtre de régime : Découvrir montre tout, en signalant ce qui est exclu.
  const env = createEnv({ lib, pantry: ctx.pantry, ratings: ctx.ratings, random: Math.random });
  const rules = toDietRules(ctx.settings);
  const allergenName = (a: string) => ALLERGENS[a as keyof typeof ALLERGENS] ?? a;

  const inWeek = new Set([current, next].flatMap((w) => (w ? weekRecipeIds(w.plan) : [])));
  const own = (id: string, r: { mu?: true }) => {
    const meta = imported[id];
    return {
      imported: !!meta,
      source: meta ? { name: meta.sourceName, url: meta.sourceUrl } : null,
      inWeek: inWeek.has(id),
      macrosUnknown: r.mu === true,
    };
  };

  const describe = (r: { ing: Record<string, number>; sv?: { ing: Record<string, number> }[]; p?: Protein }) => {
    const keys = allIngredientKeys(r);
    const allergens = recipeAllergens(keys, false);
    const blocked = rules.allergens.filter((a) => (allergens as string[]).includes(a));
    const refused = rules.refused.filter((k) => keys.includes(k)).map((k) => lib.ingredients[k]?.l ?? k);
    return {
      allergens: allergens.map(allergenName),
      excluded: !dietAllows(rules, r),
      reasons: [...blocked.map(allergenName), ...refused],
      diets: dietTags(keys, r.p) as string[],
      unverifiedAllergens: keys.some((k) => k.startsWith("h_")),
    };
  };
  const ingredients = (ing: Record<string, number>) =>
    Object.keys(ing).map((k) => `${lib.ingredients[k]?.l ?? k} : ${fmtQ(lib, k, ing[k]!)}`);

  const recipes: DiscoverRecipe[] = [
    ...lib.mains.map((r) => ({
      r,
      kind: "main" as const,
      steps: [...r.prep, ...r.blocks.flatMap((b) => b.a)],
    })),
    ...lib.soups.map((r) => ({
      r,
      kind: "soup" as const,
      steps: [...r.prep, ...r.blocks.flatMap((b) => b.a)],
    })),
    ...lib.simples.map((r) => ({ r, kind: "simple" as const, steps: r.steps })),
  ].map(({ r, kind, steps }) => ({
    id: r.id,
    kind,
    name: r.n,
    short: r.s,
    description: "d" in r ? r.d : null,
    flag: flagOf(r.o),
    region: originOf(r.o)?.region ?? null,
    seasonal: eligible(env, r, month),
    months: r.months ?? null,
    kcal: r.m[0],
    protein: r.m[1],
    freezes: "freeze" in r ? r.freeze : false,
    favorite: ctx.ratings[r.id] === 1,
    ...own(r.id, r),
    ingredients: ingredients(r.ing),
    steps: steps.map((s) => fill(lib, s, r.ing, 1)),
    ...describe(r),
  }));
  const cakes: DiscoverRecipe[] = lib.cakes.map((c) => ({
    id: c.id,
    kind: "cake",
    name: c.n,
    short: c.n,
    description: `${c.tm} · ${c.parts}. ${c.kid}`,
    flag: null,
    region: null,
    seasonal: !c.months || c.months.includes(month),
    months: c.months ?? null,
    kcal: c.m[0],
    protein: c.m[1],
    freezes: false,
    favorite: false,
    ...own(c.id, c),
    ingredients: ingredients(c.ing),
    steps: c.steps.map((s) => fill(lib, s, c.ing, 1)),
    ...describe(c),
  }));

  // Petits-déjeuners : décrits en texte libre (allergènes inconnus, voir M2).
  const supabase = await createClient();
  const { data: bf } = await supabase
    .from("recipes")
    .select("id, data")
    .eq("kind", "breakfast")
    .is("household_id", null);
  const breakfasts = (bf ?? []).map((b) => {
    const d = b.data as { n: string; d: string; t: "sucre" | "sale"; m: [number, number] };
    return {
      id: b.id ?? breakfastId(d.n),
      name: d.n.replace("{fruit}", fr.discover.seasonalFruit),
      description: d.d,
      type: d.t,
      kcal: d.m[0],
      protein: d.m[1],
    };
  });

  return (
    <DiscoverScreen
      recipes={[...recipes, ...cakes]}
      breakfasts={breakfasts}
      regions={[...new Set(recipes.map((r) => r.region).filter((x): x is string => !!x))]}
      week={week && household.role !== "viewer" ? { id: week.id, start: week.start_date } : null}
      canEdit={household.role !== "viewer"}
      openId={params.open ?? null}
      openPlan={params.plan === "1"}
      hasRestrictions={
        rules.allergens.length > 0 ||
        rules.refused.length > 0 ||
        rules.diet === "vegetarien" ||
        rules.diet === "pescetarien"
      }
    />
  );
}
