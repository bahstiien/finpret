"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { SmartSearch } from "@/components/ui/SmartSearch";
import {
  filterQuery,
  KIND_SHORT,
  NO_FILTER,
  PAGE_SIZE,
  pageCount,
  parseFilter,
  type RecipeCard,
  type RecipeFilter,
} from "@/seo/recipe-filter";
import { search, withoutHit } from "@/seo/recipe-intent";
import { RecipeTile } from "./Shell";

/**
 * Recherche et liste paginée de /recettes. Le rendu serveur contient toutes les recettes (liens indexables), celles
 * hors de la page courante en `hidden` ; la recherche s'applique ensuite dans le navigateur et se reflète dans l'URL.
 */

const plural = (n: number) => `${n} recette${n > 1 ? "s" : ""}`;

export function RecipeBrowser({ recipes }: { recipes: readonly RecipeCard[] }) {
  const [filter, setFilter] = useState<RecipeFilter>(NO_FILTER);
  const [month, setMonth] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Après l'hydratation seulement : le HTML serveur reste la première page sans recherche, identique pour tous.
  // Ce qui a été tapé avant que la page soit prête (connexion lente) n'est pas perdu.
  useEffect(() => {
    const fromUrl = parseFilter(new URLSearchParams(window.location.search));
    const typed = inputRef.current?.value ?? "";
    const next = typed && !fromUrl.q ? { q: typed, page: 1 } : fromUrl;
    setFilter(next);
    setMonth(new Date().getMonth() + 1);
    if (next !== fromUrl)
      window.history.replaceState(null, "", `${window.location.pathname}${filterQuery(next)}`);
  }, []);

  /** Changer la recherche ramène à la première page. */
  const update = (patch: Partial<RecipeFilter>) => {
    const next = { ...filter, page: 1, ...patch };
    setFilter(next);
    window.history.replaceState(null, "", `${window.location.pathname}${filterQuery(next)}`);
  };

  const result = useMemo(() => search(recipes, filter.q, month), [recipes, filter.q, month]);
  const { hits, words } = result.understood;
  const shown = result.recipes;
  const known = words.filter((w) => !result.ignored.includes(w));
  const pages = pageCount(shown.length);
  const page = Math.min(filter.page, pages);
  const first = (page - 1) * PAGE_SIZE;

  const goTo = (p: number) => {
    update({ page: p });
    listRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-6">
      <SmartSearch
        id="recipe-q"
        label="Qu'est-ce qui te ferait envie ?"
        placeholder="Un plat italien réconfortant et facile, soupe à congeler…"
        inputRef={inputRef}
        value={filter.q}
        onChange={(q) => update({ q })}
        hits={hits}
        onRemove={(h) => update({ q: withoutHit(filter.q, h) })}
        words={known}
        ignored={result.ignored}
        summary={<span className="t-small font-bold">· {plural(shown.length)}</span>}
      />

      {shown.length === 0 ? (
        <div className="card flex flex-col items-start gap-3">
          <p className="t-body">Aucune recette ne correspond à tout ça. Retire un critère pour élargir.</p>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => update(NO_FILTER)}>
            <Icon name="close" className="ic" />
            Effacer la recherche
          </button>
        </div>
      ) : (
        <>
          <ul
            ref={listRef}
            aria-label={`Recettes, page ${page}`}
            className="grid scroll-mt-6 grid-cols-2 gap-3 sm:gap-5 min-[1100px]:grid-cols-5"
          >
            {shown.map((r, i) => (
              <li key={r.slug} className="flex" hidden={i < first || i >= first + PAGE_SIZE}>
                <RecipeTile
                  href={`/recettes/${r.slug}`}
                  name={r.name}
                  photo={r.photo}
                  kicker={KIND_SHORT[r.kind]}
                  sizes="(min-width: 1100px) 220px, 50vw"
                />
              </li>
            ))}
          </ul>
          <Pagination page={page} hasNext={page < pages} onPage={goTo} label="Pages de recettes" />
        </>
      )}
    </div>
  );
}
