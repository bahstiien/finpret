"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { countryLabel } from "@/engine/passport";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Flag } from "@/components/menu/Flag";
import { useMenuAction } from "@/components/menu/useMenuAction";
import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/Controls";
import { SelectField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { FEATURES } from "@/lib/features";
import { deleteImportedRecipe } from "@/server/actions/imports";
import { setCakeAction, setWeekendAction } from "@/server/actions/menu";
import type { Flag as FlagData } from "@/server/menu-view";

const t = fr.discover;

export type DiscoverRecipe = {
  id: string;
  kind: "main" | "soup" | "simple" | "cake";
  name: string;
  short: string;
  description: string | null;
  flag: FlagData;
  region: string | null;
  /** Code pays de la recette (filtre du passeport des saveurs). */
  origin: string | null;
  seasonal: boolean;
  months: number[] | null;
  kcal: number;
  protein: number;
  freezes: boolean;
  favorite: boolean;
  imported: boolean;
  /** Recette du foyer : site d'origine (null si saisie à la main). */
  source: { name: string | null; url: string | null } | null;
  /** Au menu de la semaine en cours ou préparée (suppression avec confirmation renforcée). */
  inWeek: boolean;
  /** Macros inconnues (import sans nutrition). */
  macrosUnknown: boolean;
  /** Contient des ingrédients créés à l'import, sans table d'allergènes. */
  unverifiedAllergens: boolean;
  ingredients: string[];
  steps: string[];
  allergens: string[];
  excluded: boolean;
  reasons: string[];
  diets: string[];
};

type Breakfast = {
  id: string;
  name: string;
  description: string;
  type: "sucre" | "sale";
  kcal: number;
  protein: number;
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function DiscoverScreen({
  recipes,
  breakfasts,
  regions,
  week,
  hasRestrictions,
  canEdit,
  openId,
  openPlan,
  initialOrigin,
}: {
  recipes: DiscoverRecipe[];
  breakfasts: Breakfast[];
  regions: string[];
  week: { id: string; start: string } | null;
  hasRestrictions: boolean;
  canEdit: boolean;
  /** Lien direct vers une recette (après un import) ; `openPlan` ouvre aussi « Mettre au menu ». */
  openId: string | null;
  openPlan: boolean;
  /** `?origin=jp` : catalogue filtré sur un pays (tampon vide du passeport). */
  initialOrigin: string | null;
}) {
  const [segment, setSegment] = useState<"recipes" | "breakfasts">("recipes");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [origin, setOrigin] = useState(initialOrigin ?? "");
  const [kind, setKind] = useState("");
  const [seasonal, setSeasonal] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [vegetarian, setVegetarian] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [mine, setMine] = useState(false);
  const [target, setTarget] = useState<DiscoverRecipe | null>(
    openPlan && week ? (recipes.find((r) => r.id === openId && !r.excluded) ?? null) : null,
  );

  useEffect(() => {
    if (openId)
      document.querySelector(`[data-testid="recipe-${openId}"]`)?.scrollIntoView({ block: "center" });
  }, [openId]);

  const list = useMemo(() => {
    const q = normalize(query.trim());
    return recipes.filter(
      (r) =>
        (showAll || !r.excluded) &&
        (!q || normalize(r.name).includes(q) || r.ingredients.some((i) => normalize(i).includes(q))) &&
        (!region || r.region === region) &&
        (!origin || r.origin === origin) &&
        (!kind || r.kind === kind) &&
        (!seasonal || r.seasonal) &&
        (!favorites || r.favorite) &&
        (!mine || r.imported) &&
        (!vegetarian || r.diets.includes("vegetarien")),
    );
  }, [recipes, query, region, origin, kind, seasonal, favorites, mine, vegetarian, showAll]);

  const bfList = breakfasts.filter(
    (b) => !query.trim() || normalize(b.name).includes(normalize(query.trim())),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-black">{fr.nav.discover}</h1>
        {canEdit && FEATURES.recipeImport && (
          <Link
            href="/app/discover/import"
            className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-banana px-6 font-bold text-[#17151F]"
          >
            {t.importCta}
          </Link>
        )}
      </div>
      <div
        role="tablist"
        aria-label={t.segments}
        className="flex gap-2 self-start rounded-pill bg-surface p-1"
      >
        {(["recipes", "breakfasts"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={segment === s}
            type="button"
            onClick={() => setSegment(s)}
            className={`min-h-11 rounded-pill px-5 font-bold ${segment === s ? "bg-ink text-surface" : ""}`}
          >
            {t.segmentLabels[s]}
          </button>
        ))}
      </div>
      <label htmlFor="discover-search" className="sr-only">
        {t.search}
      </label>
      <input
        id="discover-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.search}
        className="min-h-12 rounded-pill border-2 border-line bg-surface px-5 focus:border-violet focus:outline-none"
      />

      {segment === "recipes" ? (
        <>
          {origin && (
            <button
              type="button"
              onClick={() => setOrigin("")}
              data-testid="origin-chip"
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-pill bg-violet-soft px-4 font-bold text-violet-strong"
            >
              {t.originChip(countryLabel(origin))}
              <Icon name="close" className="size-4" label={t.clearOrigin} />
            </button>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <SelectField
              id="region"
              label={t.region}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="min-w-40"
            >
              <option value="">{t.all}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="kind"
              label={t.type}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="min-w-40"
            >
              <option value="">{t.all}</option>
              {(["main", "soup", "simple", "cake"] as const).map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="flex flex-wrap gap-2">
            <ChipToggle pressed={seasonal} onToggle={() => setSeasonal(!seasonal)}>
              {t.seasonal}
            </ChipToggle>
            <ChipToggle pressed={favorites} onToggle={() => setFavorites(!favorites)}>
              {t.favorites}
            </ChipToggle>
            {recipes.some((r) => r.imported) && (
              <ChipToggle pressed={mine} onToggle={() => setMine(!mine)}>
                {t.mine}
              </ChipToggle>
            )}
            <ChipToggle pressed={vegetarian} onToggle={() => setVegetarian(!vegetarian)}>
              {t.vegetarian}
            </ChipToggle>
            {hasRestrictions && (
              <ChipToggle pressed={showAll} onToggle={() => setShowAll(!showAll)}>
                {t.showAll}
              </ChipToggle>
            )}
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {t.count(list.length)}
          </p>
          <ul className="grid gap-3 min-[900px]:grid-cols-2" data-testid="discover-list">
            {list.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                canPlan={!!week}
                canEdit={canEdit}
                open={r.id === openId}
                onPlan={() => setTarget(r)}
              />
            ))}
          </ul>
        </>
      ) : (
        <ul className="grid gap-3 min-[900px]:grid-cols-2">
          {bfList.map((b) => (
            <li key={b.id} className="flex flex-col gap-1 rounded-card bg-surface p-5">
              <span className="text-xs font-bold text-violet-strong uppercase">
                {t.breakfastTypes[b.type]}
              </span>
              <b className="text-lg">{b.name}</b>
              <p className="text-muted">{b.description}</p>
              <p className="text-sm font-semibold">{t.macros(b.kcal, b.protein)}</p>
            </li>
          ))}
        </ul>
      )}
      {target && week && <PlanSheet recipe={target} week={week} onClose={() => setTarget(null)} />}
    </>
  );
}

function RecipeCard({
  recipe: r,
  canPlan,
  canEdit,
  open,
  onPlan,
}: {
  recipe: DiscoverRecipe;
  canPlan: boolean;
  canEdit: boolean;
  open: boolean;
  onPlan: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [removing, startRemove] = useTransition();
  const remove = () => {
    if (!window.confirm(r.inWeek ? t.confirmRemoveInWeek : t.confirmRemove)) return;
    startRemove(async () => {
      const res = await deleteImportedRecipe(r.id);
      toast(res.ok ? res.data.message : res.error);
      if (res.ok) router.refresh();
    });
  };
  return (
    <li
      className={`flex flex-col gap-2 rounded-card bg-surface p-5 ${r.excluded ? "outline-2 outline-peach-ink" : ""}`}
      data-testid={`recipe-${r.id}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="text-violet-strong uppercase">{t.kinds[r.kind]}</span>
        {r.seasonal && (
          <span className="rounded-pill bg-green-soft px-2 py-0.5 text-green-ink">{t.inSeason}</span>
        )}
        {r.freezes && (
          <span className="rounded-pill bg-blue-soft px-2 py-0.5 text-blue-ink">{t.freezes}</span>
        )}
        {r.favorite && <span className="rounded-pill bg-yellow-soft px-2 py-0.5">{t.favorite}</span>}
        {r.imported && <span className="rounded-pill bg-violet px-2 py-0.5 text-white">{t.mine}</span>}
      </div>
      <b className="text-lg leading-tight">
        <Flag flag={r.flag} />
        {r.name}
      </b>
      {r.description && <p className="text-sm text-muted">{r.description}</p>}
      {!r.macrosUnknown && <p className="text-sm font-semibold">{t.macros(r.kcal, r.protein)}</p>}
      {r.source && (
        <p className="text-sm text-muted" data-testid="recipe-source">
          {r.source.name && r.source.url ? (
            <a href={r.source.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
              {t.source(r.source.name)}
            </a>
          ) : (
            t.manualSource
          )}
        </p>
      )}
      {r.excluded && (
        <p
          className="rounded-2xl bg-peach px-3 py-2 text-sm font-semibold text-peach-ink"
          data-testid="excluded"
        >
          {t.excluded(r.reasons.join(", ") || t.notYourDiet)}
        </p>
      )}
      <details open={open || undefined}>
        <summary className="min-h-11 cursor-pointer content-center font-semibold">{t.details}</summary>
        <div className="flex flex-col gap-2 pt-2">
          <h3 className="font-extrabold">{t.ingredientsFor4}</h3>
          <ul className="list-disc pl-5 text-sm">
            {r.ingredients.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <h3 className="font-extrabold">{fr.menuScreen.steps}</h3>
          <ol className="list-decimal pl-5 text-sm">
            {r.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {r.allergens.length > 0 && (
            <p className="text-sm text-muted">{t.allergens(r.allergens.join(", "))}</p>
          )}
          {r.unverifiedAllergens && <p className="text-sm font-semibold">{t.unverifiedAllergens}</p>}
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        {canPlan && !r.excluded && (
          <Button type="button" variant="outline" onClick={onPlan}>
            {t.plan}
          </Button>
        )}
        {canEdit && FEATURES.recipeImport && r.imported && (
          <>
            <Link
              href={`/app/discover/import?edit=${r.id}`}
              className="inline-flex min-h-11 items-center rounded-pill px-4 font-bold underline"
            >
              {t.edit}
            </Link>
            <button
              type="button"
              disabled={removing}
              onClick={remove}
              className="min-h-11 rounded-pill px-4 font-bold text-peach-ink underline"
            >
              {t.remove}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

/** « Mettre au menu » : un créneau du week-end, ou le goûter de la semaine. */
function PlanSheet({
  recipe,
  week,
  onClose,
}: {
  recipe: DiscoverRecipe;
  week: { id: string; start: string };
  onClose: () => void;
}) {
  const [slot, setSlot] = useState<string | null>(null);
  const { run, pending } = useMenuAction();
  const slots = ["6-lunch", "6-dinner", "7-lunch", "7-dinner"];
  return (
    <Sheet open onClose={onClose} title={t.planTitle(recipe.short)}>
      <p className="text-muted">{fr.menu.weekOf(formatShort(week.start))}</p>
      {recipe.kind === "cake" ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(() => setCakeAction(week.id, recipe.id), onClose)}
        >
          {t.asCake}
        </Button>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{t.chooseSlot}</legend>
            {slots.map((k) => {
              const [d, m] = k.split("-") as [string, "lunch" | "dinner"];
              return (
                <label
                  key={k}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-bg px-4 ${slot === k ? "outline-3 outline-violet" : ""}`}
                >
                  <input
                    type="radio"
                    name="slot"
                    checked={slot === k}
                    onChange={() => setSlot(k)}
                    className="size-5 accent-violet"
                  />
                  <span className="font-semibold first-letter:uppercase">
                    {fr.days[Number(d) - 1]} {fr.meals[m].toLowerCase()}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className="text-sm text-muted">{t.weekendOnly}</p>
          <Button
            type="button"
            disabled={!slot || pending}
            onClick={() => run(() => setWeekendAction(week.id, slot!, recipe.id), onClose)}
          >
            {t.confirmPlan}
          </Button>
        </>
      )}
    </Sheet>
  );
}
