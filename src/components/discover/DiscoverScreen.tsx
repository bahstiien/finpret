"use client";

import { useMemo, useState } from "react";
import { Flag } from "@/components/menu/Flag";
import { useMenuAction } from "@/components/menu/useMenuAction";
import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/Controls";
import { SelectField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
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
  seasonal: boolean;
  months: number[] | null;
  kcal: number;
  protein: number;
  freezes: boolean;
  favorite: boolean;
  imported: boolean;
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
}: {
  recipes: DiscoverRecipe[];
  breakfasts: Breakfast[];
  regions: string[];
  week: { id: string; start: string } | null;
  hasRestrictions: boolean;
}) {
  const [segment, setSegment] = useState<"recipes" | "breakfasts">("recipes");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [kind, setKind] = useState("");
  const [seasonal, setSeasonal] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [vegetarian, setVegetarian] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [target, setTarget] = useState<DiscoverRecipe | null>(null);

  const list = useMemo(() => {
    const q = normalize(query.trim());
    return recipes.filter(
      (r) =>
        (showAll || !r.excluded) &&
        (!q || normalize(r.name).includes(q) || r.ingredients.some((i) => normalize(i).includes(q))) &&
        (!region || r.region === region) &&
        (!kind || r.kind === kind) &&
        (!seasonal || r.seasonal) &&
        (!favorites || r.favorite) &&
        (!vegetarian || r.diets.includes("vegetarien")),
    );
  }, [recipes, query, region, kind, seasonal, favorites, vegetarian, showAll]);

  const bfList = breakfasts.filter(
    (b) => !query.trim() || normalize(b.name).includes(normalize(query.trim())),
  );

  return (
    <>
      <h1 className="text-4xl font-black">{fr.nav.discover}</h1>
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
              <RecipeCard key={r.id} recipe={r} canPlan={!!week} onPlan={() => setTarget(r)} />
            ))}
          </ul>
        </>
      ) : (
        <ul className="grid gap-3 min-[900px]:grid-cols-2">
          {bfList.map((b) => (
            <li key={b.id} className="flex flex-col gap-1 rounded-card bg-surface p-5">
              <span className="text-xs font-bold text-violet uppercase">{t.breakfastTypes[b.type]}</span>
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
  onPlan,
}: {
  recipe: DiscoverRecipe;
  canPlan: boolean;
  onPlan: () => void;
}) {
  return (
    <li
      className={`flex flex-col gap-2 rounded-card bg-surface p-5 ${r.excluded ? "outline-2 outline-peach-ink" : ""}`}
      data-testid={`recipe-${r.id}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="text-violet uppercase">{t.kinds[r.kind]}</span>
        {r.seasonal && (
          <span className="rounded-pill bg-[#e2f5e6] px-2 py-0.5 text-[#17633a]">{t.inSeason}</span>
        )}
        {r.freezes && (
          <span className="rounded-pill bg-blue-soft px-2 py-0.5 text-blue-ink">{t.freezes}</span>
        )}
        {r.favorite && <span className="rounded-pill bg-yellow-soft px-2 py-0.5">{t.favorite}</span>}
      </div>
      <b className="text-lg leading-tight">
        <Flag flag={r.flag} />
        {r.name}
      </b>
      {r.description && <p className="text-sm text-muted">{r.description}</p>}
      <p className="text-sm font-semibold">{t.macros(r.kcal, r.protein)}</p>
      {r.excluded && (
        <p
          className="rounded-2xl bg-peach px-3 py-2 text-sm font-semibold text-peach-ink"
          data-testid="excluded"
        >
          {t.excluded(r.reasons.join(", ") || t.notYourDiet)}
        </p>
      )}
      <details>
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
        </div>
      </details>
      {canPlan && !r.excluded && (
        <Button type="button" variant="outline" className="self-start" onClick={onPlan}>
          {t.plan}
        </Button>
      )}
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
