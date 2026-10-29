"use client";

import { useMemo, useState } from "react";
import { fr } from "@/i18n/fr";

export type IngredientOption = { key: string; label: string };

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Recherche dans les ingrédients du catalogue (ingrédients refusés). */
export function IngredientPicker({
  options,
  selected,
  onChange,
  label,
}: {
  options: IngredientOption[];
  selected: string[];
  onChange: (keys: string[]) => void;
  label: string;
}) {
  const t = fr.onboarding.steps.diet;
  const [query, setQuery] = useState("");
  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o.label])), [options]);
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return options.filter((o) => !selected.includes(o.key) && normalize(o.label).includes(q)).slice(0, 8);
  }, [options, query, selected]);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="refused-search" className="text-sm font-semibold">
        {label}
      </label>
      <input
        id="refused-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.refusedSearch}
        autoComplete="off"
        className="min-h-11 rounded-card border-2 border-line bg-surface px-4 focus:border-violet focus:outline-none"
      />
      {query.trim() && (
        <ul className="flex flex-wrap gap-2" aria-label={t.refusedSearch}>
          {matches.length ? (
            matches.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  className="min-h-11 rounded-r2 bg-chip px-4 text-sm font-semibold hover:bg-line"
                  onClick={() => {
                    onChange([...selected, o.key]);
                    setQuery("");
                  }}
                >
                  + {o.label}
                </button>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted">{t.noMatch}</li>
          )}
        </ul>
      )}
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((k) => (
            <li key={k}>
              <button
                type="button"
                aria-label={t.removeRefused(byKey.get(k) ?? k)}
                className="min-h-11 rounded-r2 bg-peach px-4 text-sm font-semibold text-peach-ink"
                onClick={() => onChange(selected.filter((x) => x !== k))}
              >
                {byKey.get(k) ?? k} ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
