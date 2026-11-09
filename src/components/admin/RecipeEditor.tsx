"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import {
  EDITABLE_KIND_LABEL,
  EDITABLE_KINDS,
  type EditableKind,
  recipeTemplate,
  suggestRecipeId,
} from "@/engine/catalog/admin-recipe";
import { saveCatalogRecipe } from "@/server/actions/admin-recipes";

const SEED_FILE: Record<EditableKind, string> = {
  main: "seed/mains.json",
  soup: "seed/soups.json",
  simple: "seed/simples.json",
  cake: "seed/cakes.json",
};

/**
 * Éditeur d'une recette du catalogue global, au format JSON de seed/README.md. Sert à appliquer une suggestion
 * (modification ou nouvelle recette) et à corriger directement la bibliothèque.
 */
export function RecipeEditor({
  mode,
  initialKind,
  initialId,
  initialData,
  templateName,
  initialActive,
  suggestionId,
  ingredients,
}: {
  mode: "edit" | "new";
  initialKind: EditableKind;
  initialId: string;
  /** Recette existante ; null = nouvelle recette, à partir du squelette du type choisi. */
  initialData: Record<string, unknown> | null;
  templateName: string;
  initialActive: boolean;
  suggestionId: number | null;
  ingredients: { key: string; label: string; unit: string }[];
}) {
  const [kind, setKind] = useState(initialKind);
  const [id, setId] = useState(initialId);
  const [text, setText] = useState(() =>
    JSON.stringify(initialData ?? recipeTemplate(initialKind, templateName), null, 2),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [lookup, setLookup] = useState("");

  const parsedName = useMemo(() => {
    try {
      const v = JSON.parse(text) as { n?: unknown };
      return typeof v.n === "string" ? v.n : null;
    } catch {
      return null;
    }
  }, [text]);

  const seedSnippet = useMemo(() => {
    try {
      return JSON.stringify({ id, ...(JSON.parse(text) as object) });
    } catch {
      return null;
    }
  }, [id, text]);

  const matches = useMemo(() => {
    const q = lookup.trim().toLowerCase();
    if (q.length < 2) return [];
    return ingredients.filter((i) => i.key.includes(q) || i.label.toLowerCase().includes(q)).slice(0, 12);
  }, [lookup, ingredients]);

  const format = () => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setErrors([]);
    } catch (e) {
      setErrors([`JSON invalide : ${(e as Error).message}`]);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveCatalogRecipe(fd);
      if (!res.ok) {
        setSaved(null);
        setErrors(res.error.split("\n"));
        return;
      }
      setErrors([]);
      setSaved(res.data.id);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="recipe-editor">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="data" value={text} />
      {suggestionId && <input type="hidden" name="suggestion" value={suggestionId} />}

      <div className="flex flex-wrap items-end gap-3">
        <label className="field-label flex flex-col gap-1">
          Type
          {mode === "edit" ? (
            <>
              <input type="hidden" name="kind" value={kind} />
              <span className="input content-center">{EDITABLE_KIND_LABEL[kind]}</span>
            </>
          ) : (
            <select
              name="kind"
              value={kind}
              className="input"
              onChange={(e) => {
                const next = e.target.value as EditableKind;
                setKind(next);
                // Squelette du nouveau type, tant que la recette n'a pas été remplie.
                if (!initialData) setText(JSON.stringify(recipeTemplate(next, parsedName ?? ""), null, 2));
              }}
            >
              {EDITABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EDITABLE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="field-label flex flex-1 flex-col gap-1">
          Identifiant
          <input
            name="id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            readOnly={mode === "edit"}
            required
            pattern="[a-z0-9_]{2,60}"
            className="input mono"
          />
        </label>
        {mode === "new" && parsedName && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setId(suggestRecipeId(parsedName, kind))}
          >
            Identifiant depuis le nom
          </Button>
        )}
        <label className="flex min-h-11 items-center gap-2 font-bold">
          <input type="checkbox" name="active" defaultChecked={initialActive} className="size-5 accent-ink" />
          Proposée dans les menus
        </label>
      </div>

      <label className="field-label flex flex-col gap-1">
        Recette (JSON, quantités pour 4 portions adultes, placeholders {"{clé}"})
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={28}
          spellCheck={false}
          className="input mono !min-h-96 resize-y !py-3 text-sm leading-snug"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label className="field-label flex flex-col gap-1">
          Trouver la clé d’un ingrédient
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="ex. courgette"
            className="input"
          />
        </label>
        {matches.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-sm">
            {matches.map((i) => (
              <li key={i.key} className="pill tone-chip">
                <code className="mono">{i.key}</code> · {i.label} ({i.unit})
              </li>
            ))}
          </ul>
        )}
        {lookup.trim().length >= 2 && !matches.length && (
          <p className="t-small muted">
            Aucun ingrédient : il faut d’abord l’ajouter à seed/ingredients.json (et à la table des
            allergènes).
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <FormMessage tone="error">
          <ul className="list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </FormMessage>
      )}
      {saved && (
        <FormMessage tone="success">
          Recette <code className="mono">{saved}</code> enregistrée dans la bibliothèque
          {suggestionId ? ", suggestion marquée « appliquée »" : ""}.{" "}
          <Link href="/admin/recettes" className="underline">
            Retour aux suggestions
          </Link>
        </FormMessage>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {mode === "new" ? "Ajouter à la bibliothèque" : "Enregistrer la recette"}
        </Button>
        <Button type="button" variant="outline" onClick={format}>
          Formater le JSON
        </Button>
      </div>

      {seedSnippet && (
        <details className="t-small">
          <summary className="min-h-11 cursor-pointer content-center font-bold">
            Reporter dans {SEED_FILE[kind]}
          </summary>
          <p className="muted">
            Tant qu’elle n’est pas dans le seed, la recette est conservée par <code>pnpm seed</code> mais
            absente des pages publiques du site. Ligne à coller dans le fichier :
          </p>
          <pre className="mono overflow-x-auto whitespace-pre-wrap break-all border-[length:var(--bw)] border-line p-3">
            {seedSnippet}
          </pre>
        </details>
      )}
    </form>
  );
}
