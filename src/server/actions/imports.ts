"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dietTags, recipeAllergens } from "@/engine/catalog/derive";
import { buildDraft, type ImportDraft, quality } from "@/engine/import/classify";
import { BUILTIN_SYNONYMS, householdIngredientKey } from "@/engine/import/match";
import { type ImportForm, importFormSchema, toRecipe } from "@/engine/import/to-recipe";
import { siteName } from "@/engine/import/url";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { loadLibrary } from "@/server/catalog";
import type { ActionResult } from "@/server/errors";
import { extractRecipe, extractWithModel, fetchRecipePage, rewriteSteps } from "@/server/recipe-fetch";
import { requireHousehold } from "@/server/session";

/** Import de recette par lien (§8.8) : analyse, puis enregistrement après validation par l'utilisateur. */

const t = fr.recipeImport;

async function editor() {
  if (!FEATURES.recipeImport) return null;
  const { household } = await requireHousehold("/app/discover/import");
  return household.role === "viewer" ? null : household;
}

export type AnalyzeResult = ActionResult<{
  importId: string;
  draft: ImportDraft;
  method: "jsonld" | "microdata" | "llm";
  rewritten: boolean;
  quality: { matched: number; total: number };
}>;

export async function analyzeImport(rawUrl: string): Promise<AnalyzeResult> {
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  const url = z.string().trim().min(1).max(2000).safeParse(rawUrl);
  if (!url.success) return { ok: false, error: t.errors.blocked };

  const page = await fetchRecipePage(url.data);
  // Un lien refusé (SSRF) ne compte pas dans le quota et n'est pas journalisé.
  if (!page.ok && page.error === "blocked") return { ok: false, error: t.errors.blocked };

  const supabase = await createClient();
  const { data: row, error: insertError } = await supabase
    .from("recipe_imports")
    .insert({ household_id: household.id, url: url.data })
    .select("id")
    .single();
  if (insertError || !row) {
    return { ok: false, error: insertError?.message?.includes("quota") ? t.errors.quota : fr.errors.generic };
  }
  const fail = async (key: keyof typeof t.errors) => {
    await supabase.from("recipe_imports").update({ status: "failed", error: key }).eq("id", row.id);
    return { ok: false as const, error: t.errors[key] };
  };
  if (!page.ok) return fail(page.error);

  let method: "jsonld" | "microdata" | "llm";
  let recipe;
  let steps: string[] = [];
  const structured = extractRecipe(page.html);
  if (structured) {
    method = structured.method;
    recipe = structured.recipe;
    steps = await rewriteSteps(recipe.name, recipe.instructions);
  } else {
    const fromModel = await extractWithModel(page.html);
    if (!fromModel) return fail("no_recipe");
    method = "llm";
    recipe = fromModel.recipe;
    steps = fromModel.steps;
  }

  const { lib } = await loadLibrary(household.id);
  const [{ data: synonyms }, { data: own }] = await Promise.all([
    supabase.from("ingredient_synonyms").select("synonym, ingredient_key"),
    supabase.from("household_ingredients").select("key, synonyms").eq("household_id", household.id),
  ]);
  const allSynonyms: Record<string, string> = { ...BUILTIN_SYNONYMS };
  for (const s of synonyms ?? []) allSynonyms[s.synonym] = s.ingredient_key;
  for (const h of own ?? []) for (const s of h.synonyms) allSynonyms[s] = h.key;

  const draft = buildDraft({
    recipe,
    url: page.finalUrl.toString(),
    sourceName: siteName(page.finalUrl, recipe.siteName),
    lib,
    synonyms: allSynonyms,
  });
  draft.steps = steps;
  await supabase
    .from("recipe_imports")
    .update({ status: "parsed", method, raw_ingredients: recipe.ingredients.slice(0, 60) })
    .eq("id", row.id);
  return {
    ok: true,
    data: { importId: row.id, draft, method, rewritten: steps.length > 0, quality: quality(draft.lines) },
  };
}

const saveSchema = z.object({
  importId: z.uuid().nullable(),
  editId: z
    .string()
    .regex(/^imp_[a-z0-9]+$/)
    .nullable(),
  form: importFormSchema,
  plan: z.boolean(),
});

export type SaveResult = ActionResult<{ id: string; message: string }>;

export async function saveImport(input: {
  importId: string | null;
  editId: string | null;
  form: ImportForm;
  plan: boolean;
}): Promise<SaveResult> {
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.errors.invalid };
  const { importId, editId, form } = parsed.data;
  const supabase = await createClient();
  const { lib } = await loadLibrary(household.id);

  // Ingrédients sans équivalent au catalogue : créés pour le foyer (rayon deviné, modifiable à l'écran).
  const keys: (string | null)[] = [];
  for (const line of form.lines) {
    if (line.key && lib.ingredients[line.key]) {
      keys.push(line.key);
      continue;
    }
    if (line.toTaste) {
      keys.push(null);
      continue;
    }
    const key = householdIngredientKey(household.id, line.label);
    if (!lib.ingredients[key]) {
      const { error } = await supabase.from("household_ingredients").insert({
        key,
        household_id: household.id,
        label: line.label,
        unit: line.unit,
        aisle: line.aisle === "base" ? "divers" : line.aisle,
        synonyms: line.original ? [line.label.toLowerCase()] : [],
      });
      if (error && error.code !== "23505") return { ok: false, error: fr.errors.generic };
    }
    keys.push(key);
  }

  const { kind, data } = toRecipe(form, keys);
  const ingKeys = Object.keys(data.ing);
  if (!ingKeys.length) return { ok: false, error: t.errors.invalid };
  const row = {
    kind,
    data: data as unknown as Json,
    origin: "o" in data ? data.o : null,
    protein: form.protein,
    months: data.months ?? null,
    diet_tags: dietTags(ingKeys, form.protein) as string[],
    allergens: recipeAllergens(ingKeys, false) as string[],
    source_url: form.sourceUrl,
    source_name: form.sourceName,
    status: "validated" as const,
  };

  let id: string;
  if (editId) {
    const { data: updated, error } = await supabase
      .from("recipes")
      .update(row)
      .eq("id", editId)
      .eq("household_id", household.id)
      .select("id");
    if (error || !updated?.length) return { ok: false, error: fr.errors.forbidden };
    id = editId;
  } else {
    id = `imp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("recipes")
      .insert({ ...row, id, household_id: household.id, imported_by: me.user?.id ?? null });
    if (error) return { ok: false, error: fr.errors.generic };
    if (importId) {
      await supabase.from("recipe_imports").update({ status: "validated", recipe_id: id }).eq("id", importId);
    } else {
      await supabase
        .from("recipe_imports")
        .insert({ household_id: household.id, url: "manual", status: "validated", method: "manual" });
    }
  }
  revalidatePath("/app", "layout");
  return { ok: true, data: { id, message: editId ? t.updated : t.saved } };
}

export async function deleteImportedRecipe(id: string): Promise<ActionResult<{ message: string }>> {
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  if (!/^imp_[a-z0-9]+$/.test(id)) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  // Retirée du pool sans casser les semaines qui la référencent : la ligne reste, inactive.
  const { data, error } = await supabase
    .from("recipes")
    .update({ is_active: false })
    .eq("id", id)
    .eq("household_id", household.id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: fr.errors.forbidden };
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: fr.discover.removed } };
}
