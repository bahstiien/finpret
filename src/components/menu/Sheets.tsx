"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/Controls";
import { Difficulty, Sticker } from "@/components/ui/Extras";
import { Pill } from "@/components/ui/Pill";
import { RecipeImage } from "@/components/ui/RecipeImage";
import { FormMessage } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { fmtP } from "@/engine/format";
import { fr } from "@/i18n/fr";
import {
  moveAction,
  moveTargetsAction,
  setCakeAction,
  setGuestsAction,
  setWeekendAction,
} from "@/server/actions/menu";
import type { FeedbackAction } from "@/engine/feedback";
import type { MenuView, RecipeDetail } from "@/server/menu-view";
import { Flag } from "./Flag";
import type { PickerOption } from "./MenuScreen";
import { useMenuAction } from "./useMenuAction";

const t = fr.sheets;
const slotLabel = (key: string) => {
  const [d, m] = key.split("-") as [string, "lunch" | "dinner"];
  return `${fr.days[Number(d) - 1]} ${fr.meals[m].toLowerCase()}`;
};

/** « Qui est à table ? » (§8.7) : adultes et enfants, raccourcis, total de parts. */
export function GuestsSheet({
  weekId,
  day,
  meal,
  initial,
  custom,
  onRemove,
  onMove,
  shortcuts,
  childFactor,
  onClose,
}: {
  weekId: string;
  day: number;
  meal: "lunch" | "dinner";
  initial: { a: number; c: number };
  custom: boolean;
  /** Depuis la grille « Repas à prévoir » : retire le repas du créneau. */
  onRemove?: () => void;
  /** Depuis la grille, plat du batch : ouvre « Déplacer ». */
  onMove?: () => void;
  shortcuts: { family: { a: number; c: number }; adults: { a: number; c: number } };
  childFactor: number;
  onClose: () => void;
}) {
  const [g, setG] = useState(initial);
  const { run, pending } = useMenuAction();
  const parts = g.a + g.c * childFactor;
  const tile = (key: "a" | "c", label: string, tone: string) => (
    <div className={`nb-sm flex flex-col items-center gap-3 p-4 ${tone}`}>
      <span className="t-label">{label}</span>
      <div className="stepper">
        <button
          type="button"
          aria-label={`${label} : moins`}
          disabled={g[key] <= 0}
          onClick={() => setG({ ...g, [key]: g[key] - 1 })}
        >
          −
        </button>
        <output aria-live="polite">{g[key]}</output>
        <button
          type="button"
          aria-label={`${label} : plus`}
          disabled={g[key] >= 20}
          onClick={() => setG({ ...g, [key]: g[key] + 1 })}
        >
          +
        </button>
      </div>
    </div>
  );
  return (
    <Sheet open onClose={onClose} title={t.guests.title(slotLabel(`${day}-${meal}`))}>
      <div className="grid grid-cols-2 gap-3">
        {tile("a", t.guests.adults, "tone-blue")}
        {tile("c", t.guests.children, "tone-pink")}
      </div>
      <div className="flex flex-wrap gap-2">
        <ChipToggle
          pressed={g.a === shortcuts.family.a && g.c === shortcuts.family.c}
          onToggle={() => setG(shortcuts.family)}
        >
          {t.guests.family}
        </ChipToggle>
        <ChipToggle pressed={g.a === shortcuts.adults.a && g.c === 0} onToggle={() => setG(shortcuts.adults)}>
          {t.guests.adultsOnly}
        </ChipToggle>
        {custom && (
          <ChipToggle
            pressed={false}
            onToggle={() => run(() => setGuestsAction(weekId, day, meal, null), onClose)}
          >
            {t.guests.usual}
          </ChipToggle>
        )}
      </div>
      <Button
        type="button"
        disabled={pending || g.a + g.c === 0}
        onClick={() => run(() => setGuestsAction(weekId, day, meal, g), onClose)}
      >
        {t.guests.confirm(fmtP(parts))}
      </Button>
      {onMove && (
        <Button type="button" variant="outline" disabled={pending} onClick={onMove}>
          {fr.menuScreen.moveMeal}
        </Button>
      )}
      {onRemove && (
        <Button type="button" variant="outline" disabled={pending} onClick={onRemove}>
          {t.guests.removeSlot}
        </Button>
      )}
    </Sheet>
  );
}

type Target = { key: string; ok: boolean; reason: string | null; warning: string | null };

/** « Déplacer » (§8.7) : créneaux de la même période avec le plat actuel ; soupes et soirs simples restent le soir. */
export function MoveSheet({
  weekId,
  from,
  view,
  onClose,
}: {
  weekId: string;
  from: string;
  view: MenuView;
  onClose: () => void;
}) {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [error, setError] = useState<string>();
  const [choice, setChoice] = useState<string | null>(null);
  const { run, pending } = useMenuAction();
  useEffect(() => {
    let alive = true;
    moveTargetsAction(weekId, from).then((res) => {
      if (!alive) return;
      if (res.ok) setTargets(res.data.targets);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [weekId, from]);
  const nameAt = (key: string) => {
    const [d, m] = key.split("-") as [string, "lunch" | "dinner"];
    return view.grid.find((c) => c.day === Number(d) && c.meal === m)?.name ?? null;
  };
  const chosen = targets?.find((x) => x.key === choice);
  return (
    <Sheet open onClose={onClose} title={t.move.title(nameAt(from) ?? slotLabel(from))}>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {!targets && !error && <p className="t-small muted">{t.loading}</p>}
      {targets && (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t.move.legend}</legend>
          {targets.map((x) => (
            <label
              key={x.key}
              className={`row border-[length:var(--bw)] border-line px-3 ${x.ok ? "cursor-pointer" : "tone-chip border-dashed"} ${choice === x.key ? "tone-violet" : ""}`}
            >
              <input
                type="radio"
                name="target"
                value={x.key}
                disabled={!x.ok}
                checked={choice === x.key}
                onChange={() => setChoice(x.key)}
                className="size-5 accent-ink"
              />
              <span className="row-main flex flex-col">
                <b className="t-ui first-letter:uppercase">{slotLabel(x.key)}</b>
                <span className="t-small">{nameAt(x.key) ?? fr.menu.nothing}</span>
                {!x.ok && x.reason && <span className="t-small font-bold">{x.reason}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {chosen?.warning && <FormMessage tone="error">{chosen.warning}</FormMessage>}
      <Button
        type="button"
        disabled={!choice || pending}
        onClick={() => run(() => moveAction(weekId, from, choice!), onClose)}
      >
        {t.move.confirm}
      </Button>
    </Sheet>
  );
}

/** Sélecteur de recette : week-end (§8.7) ou goûter de la semaine (§8.1). */
export function RecipePickerSheet({
  mode,
  weekId,
  slot,
  options,
  current,
  batch,
  onClose,
}: {
  mode: "weekend" | "cake";
  weekId: string;
  slot: string;
  options: PickerOption[];
  current: string | null;
  /** Créneau de semaine vide ou retiré : le prévoir (ou le remettre) avec le batch au lieu d'une recette. */
  batch?: { label: string; onPick: () => void };
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>(mode === "weekend" ? "ideas" : "seasonal");
  const [choice, setChoice] = useState<string | null>(current);
  const { run, pending } = useMenuAction();
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return options
      .filter((o) => !q || normalize(o.name).includes(q))
      .filter((o) => {
        if (filter === "ideas" || filter === "seasonal") return o.seasonal;
        if (filter === "quick") return o.quick;
        if (filter === "favorites") return o.favorite;
        if (filter === "comfort") return !!o.comfort;
        if (filter === "pasta") return !!o.pasta;
        if (filter.startsWith("type:")) return o.type === filter.slice(5);
        return true;
      });
  }, [options, query, filter]);
  const list = useMemo(() => {
    const head = filtered.slice(0, 60);
    const picked = filtered.find((o) => o.id === choice);
    return picked && !head.includes(picked) ? [picked, ...head] : head;
  }, [filtered, choice]);
  /** Tirage au sort dans la sélection filtrée, en évitant de retomber sur le choix courant. */
  const pickRandom = () => {
    const pool = filtered.length > 1 ? filtered.filter((o) => o.id !== choice) : filtered;
    if (pool.length) setChoice(pool[Math.floor(Math.random() * pool.length)]!.id);
  };
  const chosen = options.find((o) => o.id === choice);
  const filters =
    mode === "weekend"
      ? (["ideas", "comfort", "quick", "pasta", "favorites", "all"] as const).map((f) => ({
          key: f,
          label: t.picker.filters[f],
        }))
      : [
          { key: "seasonal", label: t.picker.filters.seasonal },
          ...Object.entries(fr.settings.menu.cakeTypeLabels).map(([k, label]) => ({
            key: `type:${k}`,
            label,
          })),
          { key: "all", label: t.picker.filters.all },
        ];
  const confirm = () =>
    mode === "weekend"
      ? run(() => setWeekendAction(weekId, slot, choice), onClose)
      : run(() => setCakeAction(weekId, choice!), onClose);
  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === "weekend" ? t.picker.weekendTitle(slotLabel(slot)) : t.picker.cakeTitle}
    >
      {batch && (
        <Button type="button" variant="outline" disabled={pending} onClick={batch.onPick}>
          <Icon name="pot" className="ic" />
          {batch.label}
        </Button>
      )}
      <label htmlFor="picker-search" className="sr-only">
        {t.picker.search}
      </label>
      <input
        id="picker-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.picker.search}
        className="input"
      />
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <ChipToggle key={f.key} pressed={filter === f.key} onToggle={() => setFilter(f.key)}>
            {f.label}
          </ChipToggle>
        ))}
      </div>
      <Button type="button" variant="outline" disabled={filtered.length === 0} onClick={pickRandom}>
        {t.picker.randomCount(filtered.length)}
      </Button>
      <fieldset className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto p-1">
        <legend className="sr-only">{t.picker.legend}</legend>
        {list.length === 0 && <p className="t-small muted">{t.picker.empty}</p>}
        {list.map((o) => (
          <label
            key={o.id}
            className={`row cursor-pointer border-[length:var(--bw)] border-line px-3 ${choice === o.id ? "tone-banane" : "hover:bg-chip"}`}
          >
            <input
              type="radio"
              name="recipe"
              value={o.id}
              checked={choice === o.id}
              onChange={() => setChoice(o.id)}
              className="size-5 accent-ink"
            />
            <span className="row-main t-ui">
              <Flag flag={o.flag} />
              {o.name}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="flex-1" disabled={!choice || pending} onClick={confirm}>
          {chosen
            ? mode === "weekend"
              ? t.picker.putOn(chosen.short, slotLabel(slot))
              : t.picker.chooseCake
            : t.picker.choose}
        </Button>
        {mode === "weekend" && current && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setWeekendAction(weekId, slot, null), onClose)}
          >
            {t.picker.clear}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

const ts = fr.menuScreen;

/**
 * Fiche d'un plat, ouverte en touchant sa carte : ingrédients aux quantités de la semaine, matériel, étapes.
 * `feedback` : seulement pour un plat déjà mangé ; `actions` : Doubler / Changer quand la semaine s'organise.
 */
export function RecipeSheet({
  recipe: r,
  onFeedback,
  pending,
  actions,
  onClose,
}: {
  recipe: RecipeDetail;
  onFeedback?: (a: FeedbackAction) => void;
  pending: boolean;
  actions?: React.ReactNode;
  onClose: () => void;
}) {
  const f = r.feedback;
  // Classes écrites en entier : Tailwind ne voit pas une classe construite à l'exécution.
  const chip = (on: boolean, tone: "green" | "peach") =>
    `chiptg ${on ? (tone === "green" ? "[background:var(--green)]" : "[background:var(--peach)]") : ""}`;
  // « Riz : 210 g » → nom à gauche, quantité en Space Mono à droite.
  const split = (line: string) => {
    const i = line.lastIndexOf(" : ");
    return i < 0 ? [line, ""] : [line.slice(0, i), line.slice(i + 3)];
  };
  const level = r.difficulty >= 1 && r.difficulty <= 4 ? (r.difficulty as 1 | 2 | 3 | 4) : null;
  const facts = [
    { label: ts.facts.for, value: <span className="mono">{r.portions}</span> },
    ...(r.cost ? [{ label: ts.facts.cost, value: <span className="mono">{r.cost}</span> }] : []),
    ...(level
      ? [
          {
            label: ts.facts.difficulty,
            value: (
              <span className="flex items-center gap-2">
                <span>{fr.menuView.difficulty.levels[level - 1]}</span>
                <Difficulty level={level} />
              </span>
            ),
          },
        ]
      : []),
  ];
  return (
    <Sheet open onClose={onClose} title={r.name} wide>
      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8"
        data-testid="recipe-sheet"
      >
        {/* Colonne de gauche, fixe au défilement sur grand écran : ce qu'il faut avoir sous la main. */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-0">
          {r.photo && (
            <div className="relative">
              <RecipeImage
                photo={r.photo}
                sizes="(min-width: 1024px) 340px, 100vw"
                decorative
                className="nb aspect-[4/3]"
              />
              {/* Le nom est déjà le titre de la feuille : l'étiquette dit le type de plat et l'origine. */}
              <Sticker tone="banane" className="absolute -bottom-3 left-3">
                <Flag flag={r.flag} />
                {r.title}
              </Sticker>
            </div>
          )}
          {!r.photo && (
            <p className="t-kicker">
              <Flag flag={r.flag} />
              {r.title}
            </p>
          )}
          {/* Fiche d'identité en lignes : libellé à gauche, valeur à droite, comme les ingrédients. */}
          <dl className="nb-flat flex flex-col divide-y-[length:var(--bw)] divide-line">
            {facts.map((x) => (
              <div key={x.label} className="flex min-h-11 items-center justify-between gap-4 px-3 py-2">
                <dt className="t-label">{x.label}</dt>
                <dd className="t-small text-right font-bold">{x.value}</dd>
              </div>
            ))}
          </dl>
          {r.ingredients.length > 0 && (
            <section className="nb-sm tone-chip flex flex-col gap-3 p-4">
              <h3 className="t-3">{ts.ingredients}</h3>
              <ul className="flex flex-col">
                {r.ingredients.map((line) => {
                  const [name, qty] = split(line);
                  return (
                    <li
                      key={line}
                      className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0"
                    >
                      <span>{name}</span>
                      <span className="mono shrink-0 text-right font-bold">{qty}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {r.equipment.length > 0 && (
            <section className="flex flex-col gap-2" data-testid="recipe-equipment">
              <h3 className="t-3">{ts.equipment}</h3>
              <ul className="flex flex-wrap gap-2">
                {r.equipment.map((x) => (
                  <li key={x}>
                    <Pill>{x}</Pill>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Colonne de droite : la recette se lit de haut en bas. */}
        <div className="flex flex-col gap-6">
          {r.description && <p className="t-body max-w-[60ch]">{r.description}</p>}
          <section className="flex flex-col gap-4">
            <h3 className="t-3">{ts.steps}</h3>
            <ol className="flex flex-col gap-4">
              {r.steps.map((x, j) => (
                <li key={j} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="nb-sm tone-violet mono grid size-9 place-items-center text-base font-bold"
                  >
                    {j + 1}
                  </span>
                  <p className="max-w-[60ch] pt-1.5">{x}</p>
                </li>
              ))}
            </ol>
          </section>
          {r.notes.length > 0 && (
            <aside className="callout tone-blue" aria-label={ts.goodToKnow}>
              <span className="callout-ic">
                <Icon name="snow" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="t-ui">{ts.goodToKnow}</p>
                {r.notes.map((n) => (
                  <p key={n} className="t-small">
                    {n}
                  </p>
                ))}
              </div>
            </aside>
          )}
          {onFeedback && (
            <section className="flex flex-col gap-2" role="group" aria-label={ts.feedbackHint}>
              <h3 className="t-3">{ts.feedbackTitle}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={f.rating === 1}
                  aria-label={ts.like(r.name)}
                  disabled={pending}
                  onClick={() => onFeedback("redo")}
                  className={chip(f.rating === 1, "green")}
                >
                  <Icon name="thumbUp" className="size-5" />
                  {ts.likeShort}
                </button>
                <button
                  type="button"
                  aria-pressed={f.kids}
                  aria-label={ts.kids(r.name)}
                  disabled={pending}
                  onClick={() => onFeedback("kids")}
                  className={chip(f.kids, "green")}
                >
                  {ts.kidsShort}
                </button>
                <button
                  type="button"
                  aria-pressed={f.long}
                  aria-label={ts.tooLong(r.name)}
                  disabled={pending}
                  onClick={() => onFeedback("long")}
                  className={chip(f.long, "peach")}
                >
                  {ts.tooLongShort}
                </button>
                <button
                  type="button"
                  aria-pressed={f.rating === -1}
                  aria-label={ts.dislike(r.name)}
                  disabled={pending}
                  onClick={() => onFeedback("refuse")}
                  className={`iconbtn ${f.rating === -1 ? "[background:var(--peach)]" : ""}`}
                >
                  <Icon name="thumbDown" className="size-5" />
                </button>
              </div>
            </section>
          )}
          {actions && (
            <div className="flex flex-wrap items-center gap-2 border-t-[length:var(--bw)] border-line pt-4">
              {actions}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
