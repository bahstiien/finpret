"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { EDITABLE_KINDS, type EditableKind } from "@/engine/catalog/admin-recipe";
import { fr } from "@/i18n/fr";
import { sendRecipeSuggestion } from "@/server/actions/recipe-suggestions";

const t = fr.suggest;

/** Suggestion envoyée à l'équipe : correction d'une recette de la bibliothèque (`recipe`) ou nouvelle recette. */
export function SuggestSheet({
  recipe,
  onClose,
}: {
  recipe: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<EditableKind>("main");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const message = String(f.get("message") ?? "");
    start(async () => {
      const res = await sendRecipeSuggestion(
        recipe
          ? { kind: "edit", recipeId: recipe.id, message }
          : {
              kind: "new",
              recipeKind: kind,
              title: String(f.get("title") ?? ""),
              message,
              sourceUrl: String(f.get("sourceUrl") ?? ""),
            },
      );
      if (!res.ok) return setError(res.error);
      toast(res.data.message);
      onClose();
    });
  };

  return (
    <Sheet open onClose={onClose} title={recipe ? t.editTitle(recipe.name) : t.newTitle}>
      <form onSubmit={submit} className="flex flex-col gap-4" data-testid="suggest-form">
        <p className="muted">{recipe ? t.editIntro : t.newIntro}</p>
        {!recipe && (
          <>
            <SelectField
              id="suggest-kind"
              label={t.kindLabel}
              value={kind}
              onChange={(e) => setKind(e.target.value as EditableKind)}
            >
              {EDITABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </SelectField>
            <TextField
              id="suggest-title"
              name="title"
              label={t.nameLabel}
              required
              minLength={2}
              maxLength={120}
            />
          </>
        )}
        <TextArea
          id="suggest-message"
          name="message"
          label={recipe ? t.editLabel : t.recipeLabel}
          placeholder={recipe ? t.editPlaceholder : t.recipePlaceholder}
          required
          minLength={5}
          maxLength={4000}
          rows={recipe ? 5 : 8}
        />
        {!recipe && (
          <TextField
            id="suggest-source"
            name="sourceUrl"
            type="url"
            inputMode="url"
            label={t.sourceLabel}
            placeholder="https://"
            maxLength={2000}
          />
        )}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Button type="submit" disabled={pending}>
          {t.send}
        </Button>
      </form>
    </Sheet>
  );
}
