import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeEditor } from "@/components/admin/RecipeEditor";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import {
  EDITABLE_KIND_LABEL,
  EDITABLE_KINDS,
  type EditableKind,
  suggestRecipeId,
} from "@/engine/catalog/admin-recipe";
import { requireAdmin } from "@/server/admin";
import { catalogIngredients, getCatalogRecipe, getSuggestion } from "@/server/recipe-suggestions";

/**
 * Éditeur du catalogue global : `?recipe=` modifie une recette, `?suggestion=` applique une suggestion
 * (la recette visée, ou un squelette de nouvelle recette), `?new=main` ajoute une recette sans suggestion.
 */
export default async function ApplySuggestionPage({
  searchParams,
}: {
  searchParams: Promise<{ suggestion?: string; recipe?: string; new?: string }>;
}) {
  const { role } = await requireAdmin();
  // Écriture du catalogue : rôle `owner` seulement.
  if (role !== "owner") notFound();
  const sp = await searchParams;
  const suggestionId = Number(sp.suggestion);
  const suggestion =
    Number.isInteger(suggestionId) && suggestionId > 0 ? await getSuggestion(suggestionId) : null;
  if (sp.suggestion && !suggestion) notFound();

  const recipeId = sp.recipe ?? (suggestion?.kind === "edit" ? suggestion.recipe_id : null);
  const recipe = recipeId ? await getCatalogRecipe(recipeId) : null;
  if (recipeId && !recipe) notFound();
  if (recipe && recipe.kind === "breakfast") notFound();

  const ingredients = await catalogIngredients();
  const newKind: EditableKind = suggestion?.recipe_kind ?? EDITABLE_KINDS.find((k) => k === sp.new) ?? "main";
  const mode = recipe ? "edit" : "new";
  const kind = (recipe?.kind as EditableKind | undefined) ?? newKind;
  const title = recipe
    ? `Modifier « ${recipe.name} »`
    : suggestion
      ? `Ajouter « ${suggestion.title} »`
      : "Ajouter une recette";

  return (
    <>
      <p className="t-small">
        <Link
          href={suggestion ? `/admin/recettes#suggestion-${suggestion.id}` : "/admin/bibliotheque"}
          className="underline"
        >
          ← {suggestion ? "Suggestions" : "Bibliothèque"}
        </Link>
      </p>
      <PageHeader
        title={title}
        description={`${EDITABLE_KIND_LABEL[kind]} · le régime, les allergènes et la protéine sont recalculés à l'enregistrement.`}
      />
      {suggestion && (
        <Card className="flex flex-col gap-2 !shadow-none tone-banane">
          <p className="t-label">
            Suggestion de {suggestion.email ?? "compte supprimé"}
            {suggestion.status !== "new" && " (déjà traitée)"}
          </p>
          <p className="whitespace-pre-line [overflow-wrap:anywhere]">{suggestion.message}</p>
          {suggestion.source_url && (
            <a
              href={suggestion.source_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="lnk t-small"
            >
              {suggestion.source_url}
            </a>
          )}
        </Card>
      )}
      {recipe?.edited_in_admin_at && (
        <p className="callout tone-warning t-small">
          Déjà modifiée dans le back-office : <code>pnpm seed</code> la conserve tant que seed/*.json n’a pas
          la même version.
        </p>
      )}
      <RecipeEditor
        mode={mode}
        initialKind={kind}
        initialId={recipe?.id ?? (suggestion ? suggestRecipeId(suggestion.title, kind) : "")}
        initialData={recipe ? (recipe.data as Record<string, unknown>) : null}
        templateName={suggestion?.title ?? ""}
        initialActive={recipe?.is_active ?? true}
        suggestionId={suggestion?.id ?? null}
        ingredients={ingredients}
      />
    </>
  );
}
