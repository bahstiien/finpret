import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ImportScreen } from "@/components/discover/ImportScreen";
import { fromRecipe } from "@/engine/import/to-recipe";
import { urlFromShare } from "@/engine/import/url";
import { ORIGINS } from "@/engine/origins";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { loadLibrary } from "@/server/catalog";
import { requireHousehold, withSession } from "@/server/session";

export const metadata: Metadata = { title: fr.recipeImport.title };

type Params = { url?: string; text?: string; title?: string; edit?: string };

/** Import d'une recette par lien (§8.8) ; aussi cible de partage du téléphone (`share_target`) et modification. */
export default async function ImportPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!FEATURES.recipeImport) notFound();
  const params = await searchParams;
  const { household } = await requireHousehold("/app/discover/import");
  if (household.role === "viewer") redirect("/app/discover");
  const { lib } = await loadLibrary(household.id);

  let edit: { id: string; form: ReturnType<typeof fromRecipe> } | null = null;
  if (params.edit) {
    const editId = params.edit;
    const data = await withSession((db) =>
      db
        .selectFrom("recipes")
        .select(["id", "kind", "data", "source_url", "source_name"])
        .where("id", "=", editId)
        .where("household_id", "=", household.id)
        .executeTakeFirst(),
    );
    if (!data || data.kind === "breakfast") redirect("/app/discover");
    edit = {
      id: data.id,
      form: fromRecipe(
        data.kind,
        data.data as Record<string, unknown>,
        { url: data.source_url, name: data.source_name },
        lib.ingredients,
      ),
    };
  }

  const ingredients = Object.entries(lib.ingredients)
    .map(([key, g]) => ({ key, label: g.l, unit: g.u, aisle: g.c }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  return (
    <ImportScreen
      initialUrl={edit ? "" : urlFromShare(params)}
      edit={edit}
      ingredients={ingredients}
      aisles={[...lib.aisles, ["base", fr.recipeImport.toTaste]]}
      origins={Object.entries(ORIGINS).map(([code, o]) => [code, `${o.flag} ${o.name}`])}
    />
  );
}
