import type { ReactNode, Ref } from "react";
import { Icon } from "./Icon";

/** Un morceau de la demande compris comme un critère (« Italie », « Facile »). */
export type SmartSearchHit = { label: string };

/**
 * Champ de recherche intelligent : l'utilisateur écrit comme il parle, le champ montre ce qu'il a compris en pastilles
 * qu'on retire d'un clic, les mots cherchés tels quels et les mots ignorés. L'interprétation est faite par l'appelant
 * (pour les recettes : `understand` et `search` de `src/seo/recipe-intent.ts`) ; rien ne s'affiche sous un champ vide.
 */
export function SmartSearch<H extends SmartSearchHit>({
  id,
  label,
  placeholder,
  value,
  onChange,
  hits,
  onRemove,
  words = [],
  ignored = [],
  summary,
  inputRef,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  hits: readonly H[];
  onRemove: (hit: H) => void;
  /** Mots non compris mais cherchés dans le texte. */
  words?: readonly string[];
  /** Mots qui ne mènent à rien, laissés de côté. */
  ignored?: readonly string[];
  /** Fin de la ligne d'interprétation, par exemple le nombre de résultats. */
  summary?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const help = `${id}-help`;
  const active = value.trim() !== "";
  return (
    <div role="search" className="field max-w-[640px]">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <span className="relative flex items-center">
        <Icon name="search" className="ic pointer-events-none absolute left-3.5" />
        <input
          id={id}
          ref={inputRef}
          type="search"
          className="input !pl-11"
          placeholder={placeholder}
          aria-describedby={active ? help : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      <div id={help} className="flex flex-wrap items-center gap-2 empty:hidden" aria-live="polite">
        {active && (
          <>
            {hits.length > 0 && <span className="field-help">J&apos;ai compris :</span>}
            {hits.map((h) => (
              <button
                key={h.label}
                type="button"
                className="pill cursor-pointer"
                aria-label={`Retirer « ${h.label} » de la recherche`}
                onClick={() => onRemove(h)}
              >
                {h.label}
                <Icon name="close" className="h-3 w-3" />
              </button>
            ))}
            {words.length > 0 && <span className="field-help">avec « {words.join(" ")} »</span>}
            {ignored.length > 0 && <span className="field-help">· ignoré : « {ignored.join(" ")} »</span>}
            {summary}
          </>
        )}
      </div>
    </div>
  );
}
