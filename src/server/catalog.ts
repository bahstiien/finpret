import "server-only";
import { cache } from "react";
import type { Cake, Ingredient, Main, Pack, Simple, Soup } from "@/engine/catalog/schema";
import type { Library } from "@/engine/types";
import { createClient } from "@/lib/supabase/server";

/** Bonus de tirage des recettes importées par le foyer (§8.8 : +0,3, un favori atténué). */
export const IMPORTED_BONUS = 0.3;

type IngredientRow = {
  key: string;
  label: string;
  unit: Ingredient["u"];
  aisle: string;
  forms: { n?: [string, string]; showN?: boolean; s?: string } | null;
  half: boolean;
  seasonal: boolean;
};

/**
 * Catalogue du moteur : catalogue global et recettes validées du foyer, au format du prototype.
 * Lu une fois par requête (React cache), sous la RLS de l'utilisateur.
 */
export const loadLibrary = cache(
  async (householdId: string): Promise<{ lib: Library; bonus: Record<string, number> }> => {
    const supabase = await createClient();
    const [aisles, ingredients, packs, recipes] = await Promise.all([
      supabase.from("aisles").select("key, label, position").order("position"),
      supabase.from("ingredients").select("key, label, unit, aisle, forms, half, seasonal"),
      supabase.from("packs").select("ingredient_key, sizes, label, tolerance"),
      supabase
        .from("recipes")
        .select("id, kind, data, household_id, status")
        .eq("is_active", true)
        .or(`household_id.is.null,household_id.eq.${householdId}`),
    ]);
    for (const res of [aisles, ingredients, packs, recipes]) if (res.error) throw res.error;

    const ing: Record<string, Ingredient> = {};
    const notSeasonal: string[] = [];
    for (const row of (ingredients.data ?? []) as IngredientRow[]) {
      const f = row.forms ?? {};
      ing[row.key] = {
        l: row.label,
        u: row.unit,
        c: row.aisle,
        ...(f.n && { n: f.n }),
        ...(f.showN && { showN: f.showN }),
        ...(f.s && { s: f.s }),
        ...(row.half && { half: true }),
      };
      if (row.aisle === "legumes" && !row.seasonal) notSeasonal.push(row.key);
    }
    const packMap: Record<string, Pack> = {};
    for (const p of packs.data ?? []) {
      packMap[p.ingredient_key] = {
        s: p.sizes,
        l: p.label,
        ...(p.tolerance !== 0.2 && { tol: Number(p.tolerance) }),
      };
    }

    const lib: Library = {
      mains: [],
      soups: [],
      simples: [],
      cakes: [],
      ingredients: ing,
      packs: packMap,
      notSeasonal,
      aisles: (aisles.data ?? []).filter((a) => a.key !== "base").map((a) => [a.key, a.label]),
    };
    const bonus: Record<string, number> = {};
    for (const r of recipes.data ?? []) {
      if (r.status !== "validated") continue;
      const recipe = { id: r.id, ...(r.data as object) };
      if (r.household_id) bonus[r.id] = IMPORTED_BONUS;
      if (r.kind === "main") lib.mains.push(recipe as Main);
      else if (r.kind === "soup") lib.soups.push(recipe as Soup);
      else if (r.kind === "simple") lib.simples.push(recipe as Simple);
      else if (r.kind === "cake") lib.cakes.push(recipe as Cake);
    }
    return { lib, bonus };
  },
);
