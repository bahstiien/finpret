"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { RecipeImage } from "@/components/ui/RecipeImage";
import { dur } from "@/engine/format";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import {
  prepareWeekAction,
  feedbackAction,
  suggestWeekendAction,
  swapDish,
  toggleDoubleAction,
  toggleGridSlot,
} from "@/server/actions/menu";
import type { FeedbackAction } from "@/engine/feedback";
import type { DishCard, MenuView } from "@/server/menu-view";
import type { StreakState } from "@/engine/streak";
import { SeriesBanner } from "./SeriesBanner";
import { WeekBoard, type BoardFilter } from "./WeekBoard";
import { Flag } from "./Flag";
import { GuestsSheet, MoveSheet, RecipePickerSheet } from "./Sheets";
import { useMenuAction } from "./useMenuAction";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/Layout";

const t = fr.menuScreen;
const tv = fr.menuView;

export type PickerOption = {
  id: string;
  name: string;
  short: string;
  flag: MenuView["dishes"][number]["flag"];
  seasonal: boolean;
  quick: boolean;
  favorite: boolean;
  comfort?: boolean;
  pasta?: boolean;
  type: string;
};

export type CanteenEntry = {
  name: string;
  text: string;
  duplicates: string[];
  note?: string | null;
  edited?: boolean;
};

/** Menu de la cantine dans la carte-jour ; `current` : jour sélectionné (repère des tests de bout en bout). */
function CanteenBlock({ entry, current }: { entry: CanteenEntry; current: boolean }) {
  return (
    <div className="nb-sm flex flex-col gap-2 p-3" data-testid={current ? "canteen-today" : "canteen-day"}>
      <h3 className="t-label">{fr.canteen.today(entry.name)}</h3>
      <p className="t-ui">{entry.text}</p>
      {entry.note && <p className="t-small muted">{entry.note}</p>}
      {entry.edited && (
        <p className="t-small muted" data-testid="canteen-edited">
          {fr.canteen.edited}
        </p>
      )}
      {entry.duplicates.length > 0 && (
        <p
          className="nb-sm tone-peach t-small px-3 py-2 font-bold"
          role="note"
          data-testid="canteen-duplicate"
        >
          {fr.canteen.duplicate(entry.duplicates.join(", "))}
        </p>
      )}
    </div>
  );
}

type Sheet =
  | {
      kind: "guests";
      day: number;
      meal: "lunch" | "dinner";
      counts: { a: number; c: number };
      custom: boolean;
      /** Ouverte depuis la grille : propose aussi « Ne rien prévoir ». */
      fromGrid?: boolean;
    }
  | { kind: "move"; from: string }
  | { kind: "weekend"; key: string }
  | { kind: "cake" }
  | null;

export function MenuScreen({
  header,
  view,
  canEdit,
  sessionMinutes,
  weekendOptions,
  cakeOptions,
  shortcuts,
  childFactor,
  weeks,
  canteen = {},
  streak,
}: {
  header: { date: string; greeting: string; name: string };
  view: MenuView;
  canEdit: boolean;
  sessionMinutes: number;
  weekendOptions: PickerOption[];
  cakeOptions: PickerOption[];
  shortcuts: { family: { a: number; c: number }; adults: { a: number; c: number } };
  childFactor: number;
  weeks: {
    isCurrent: boolean;
    hasNext: boolean;
    hasCurrent: boolean;
    nextStart: string;
    canPrepareNext: boolean;
  };
  /** Cantine des enfants par date (§13), avec les bases en commun avec le dîner. */
  canteen?: Record<string, CanteenEntry[]>;
  /** Série fin prête (Progrès), si le foyer la montre. */
  streak?: Pick<StreakState, "current" | "currentWeek"> | null;
}) {
  const inWeek = view.todayIndex >= 1 && view.todayIndex <= 7;
  const [selected, setSelected] = useState(inWeek ? view.todayIndex : 1);
  const [filter, setFilter] = useState<BoardFilter>("week");
  const [sheet, setSheet] = useState<Sheet>(null);
  const { run, pending } = useMenuAction();
  const today = inWeek ? view.days[view.todayIndex - 1] : null;
  // Alerte doublon cantine / dîner (§13) : un bandeau par jour concerné, « Changer » sur le plat du soir.
  const alerts = view.days.flatMap((d) => {
    const groups = [...new Set((canteen[d.iso] ?? []).flatMap((c) => c.duplicates))];
    if (!groups.length) return [];
    const dinner = d.meals.find((m) => m.meal === "dinner" && !m.removed);
    return [{ day: d.day, groups, dinner: dinner && dinner.kind !== "weekend" ? dinner : null }];
  });
  const tonightName = today?.meals.find((m) => m.meal === "dinner" && !m.removed)?.name;

  return (
    <>
      <div className="ph">
        <div className="flex flex-col gap-2.5">
          <p className="t-kicker first-letter:uppercase" data-testid="week-title">
            {fr.menu.weekOf(formatShort(view.start))}
          </p>
          <h1 className="t-1 [overflow-wrap:anywhere]">{t.title}</h1>
          <p className="t-small muted" data-testid="menu-greeting">
            {header.greeting}, <span className="break-words">{header.name}</span>{" "}
            <span aria-hidden="true">👋</span>
            {tonightName && (
              <>
                {" "}
                {t.tonightLead} <b className="text-ink">{tonightName.toLowerCase()}</b>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {weeks.hasNext && (
            <LinkButton href="/app?week=next" variant="secondary" size="sm">
              {t.nextWeek}
            </LinkButton>
          )}
          {weeks.hasCurrent && (
            <LinkButton href="/app" variant="outline" size="sm">
              {t.currentWeek}
            </LinkButton>
          )}
          <Link href={`/app/print?week=${view.start}`} aria-label={t.print} className="iconbtn">
            <Icon name="print" />
          </Link>
        </div>
      </div>

      {alerts.map((a) => (
        <div
          key={a.day}
          role="status"
          className="callout tone-alerte items-center text-sm font-bold"
          data-testid="menu-alert"
        >
          <span className="callout-ic">
            <Icon name="warning" />
          </span>
          <span className="flex-1">{t.duplicateAlert(fr.days[a.day - 1]!, a.groups.join(", "))}</span>
          {canEdit && a.dinner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => swapDish(view.weekId, a.dinner!.kind as DishCard["kind"], a.dinner!.index))
              }
            >
              {t.change}
            </Button>
          )}
        </div>
      ))}

      <Card
        tone="peach"
        className="flex flex-wrap items-center justify-between gap-4"
        data-testid="week-summary"
      >
        <div className="flex flex-col gap-1.5">
          <p className="t-kicker">{t.sessionBanner.kicker}</p>
          <p className="t-2">{t.sessionBanner.title(view.plannedMeals, dur(sessionMinutes))}</p>
        </div>
        <LinkButton href="/app/session" size="lg">
          {t.sessionBanner.go}
        </LinkButton>
      </Card>

      {streak && <SeriesBanner streak={streak} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg" role="group" aria-label={t.filter.label}>
          {(["week", "lunch", "dinner", "weekend"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t.filter[f]}
            </button>
          ))}
        </div>
        <p className="t-kicker muted">
          <span data-testid="summary-meals">{view.plannedMeals}</span> {t.board.mealsUnit}
        </p>
      </div>

      <WeekBoard
        view={view}
        filter={filter}
        selected={selected}
        onSelect={setSelected}
        canEdit={canEdit}
        weekId={view.weekId}
        onMove={(from) => setSheet({ kind: "move", from })}
        onGuests={(m) =>
          setSheet({ kind: "guests", day: m.day, meal: m.meal, counts: m.counts, custom: m.guestsCustom })
        }
        extraFor={(d) =>
          (canteen[d.iso] ?? []).map((c) => <CanteenBlock key={c.name} entry={c} current={d.day === selected} />)
        }
      />

      <div className="max-w-3xl">
        <PlanGrid
          view={view}
          canEdit={canEdit}
          pending={pending}
          onToggle={(d, m) => run(() => toggleGridSlot(view.weekId, d, m))}
          onGuests={(c) =>
            setSheet({ kind: "guests", day: c.day, meal: c.meal, counts: c.counts, custom: c.custom, fromGrid: true })
          }
          onWeekend={(key) => setSheet({ kind: "weekend", key })}
          onSuggest={() => run(() => suggestWeekendAction(view.weekId))}
          cakeLine={
            view.cake ? (
              <CakeLine cake={view.cake} canEdit={canEdit} onChange={() => setSheet({ kind: "cake" })} />
            ) : null
          }
        />
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title={t.dishes}
          aside={<span className="mono">{t.dishCount(view.dishes.length)}</span>}
        />
        <ul className="flex flex-col gap-3" data-testid="dishes">
          {view.dishes.map((d) => (
            <DishRow
              key={`${d.kind}-${d.index}`}
              dish={d}
              recipe={view.recipes.find((r) => r.recipeId === d.recipeId) ?? null}
              canEdit={canEdit}
              pending={pending}
              onFeedback={(a) => run(() => feedbackAction(view.weekId, d.recipeId, a))}
              onDouble={() => run(() => toggleDoubleAction(view.weekId, d.index))}
              onSwap={() => run(() => swapDish(view.weekId, d.kind, d.index))}
            />
          ))}
        </ul>
      </section>

      {canEdit && (
        <section className="flex flex-wrap gap-3">
          {weeks.canPrepareNext && (
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => prepareWeekAction(weeks.nextStart))}
            >
              {t.prepareNext}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t.regenerateConfirm)) run(() => prepareWeekAction(view.start));
            }}
          >
            {fr.menu.regenerate}
          </Button>
          <LinkButton href="/settings/menu" variant="ghost">
            {t.quickSettings}
          </LinkButton>
        </section>
      )}

      {sheet?.kind === "guests" && (
        <GuestsSheet
          weekId={view.weekId}
          day={sheet.day}
          meal={sheet.meal}
          initial={sheet.counts}
          custom={sheet.custom}
          onRemove={
            sheet.fromGrid
              ? () => run(() => toggleGridSlot(view.weekId, sheet.day, sheet.meal), () => setSheet(null))
              : undefined
          }
          shortcuts={shortcuts}
          childFactor={childFactor}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "move" && (
        <MoveSheet weekId={view.weekId} from={sheet.from} view={view} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "weekend" && (
        <RecipePickerSheet
          mode="weekend"
          weekId={view.weekId}
          slot={sheet.key}
          options={weekendOptions}
          current={view.weekend.find((w) => w.key === sheet.key)?.recipeId ?? null}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "cake" && (
        <RecipePickerSheet
          mode="cake"
          weekId={view.weekId}
          slot=""
          options={cakeOptions}
          current={view.cake?.id ?? null}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

function PlanGrid({
  view,
  canEdit,
  pending,
  onToggle,
  onGuests,
  onWeekend,
  onSuggest,
  cakeLine,
}: {
  view: MenuView;
  canEdit: boolean;
  pending: boolean;
  onToggle: (d: number, m: "lunch" | "dinner") => void;
  onGuests: (c: MenuView["grid"][number]) => void;
  onWeekend: (key: string) => void;
  onSuggest: () => void;
  cakeLine: React.ReactNode;
}) {
  const cell = (d: number, m: "lunch" | "dinner") => view.grid.find((c) => c.day === d && c.meal === m)!;
  const weekendGaps = view.grid.some((c) => c.day > 5 && c.state !== "set");
  return (
    <Card padding="cozy" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-2">{t.grid.title}</h2>
        <span className="t-small flex gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-3 border-[length:var(--bw)] border-line bg-violet" aria-hidden="true" />{" "}
            {t.grid.batch}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 border-[length:var(--bw)] border-line bg-banane" aria-hidden="true" />{" "}
            {t.grid.weekend}
          </span>
        </span>
      </div>
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th />
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <th key={d} scope="col" className={`t-label ${d === view.todayIndex ? "tone-banane" : ""}`}>
                {fr.daysShort[d - 1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["lunch", "dinner"] as const).map((m) => (
            <tr key={m}>
              <th scope="row" className="t-label pr-1 text-left">
                {fr.meals[m]}
              </th>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const c = cell(d, m);
                const slot = `${fr.days[d - 1]} ${fr.meals[m].toLowerCase()}`;
                if (d > 5) {
                  return (
                    <td key={d}>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => onWeekend(`${d}-${m}`)}
                        aria-label={c.name ? t.grid.weekendSet(slot, c.name) : t.grid.weekendEmpty(slot)}
                        className={`grid h-11 w-full place-items-center rounded-r1 border-[length:var(--bw)] border-line ${
                          c.state === "set" ? "tone-banane" : "tone-surface border-dashed"
                        }`}
                      >
                        {c.state === "set" ? (
                          <Icon name="check" className="size-5" />
                        ) : (
                          <Icon name="plus" className="size-5" />
                        )}
                      </button>
                    </td>
                  );
                }
                const on = c.state === "on";
                const replace = c.state === "removed";
                return (
                  <td key={d}>
                    <button
                      type="button"
                      disabled={!canEdit || pending}
                      aria-pressed={on}
                      aria-haspopup={on ? "dialog" : undefined}
                      onClick={() => (on ? onGuests(c) : onToggle(d, m))}
                      aria-label={on ? t.grid.on(slot, c.name ?? "", c.counts.a + c.counts.c) : t.grid.off(slot)}
                      className={`mono grid h-11 w-full place-items-center rounded-r1 border-[length:var(--bw)] border-line ${
                        on
                          ? d === view.todayIndex
                            ? "tone-banane"
                            : "tone-violet"
                          : replace
                            ? "tone-yellow border-dashed border-violet"
                            : "tone-chip muted"
                      }`}
                    >
                      {on ? (
                        <span className={`text-base font-bold ${c.custom ? "underline decoration-2 underline-offset-4" : ""}`}>
                          {c.counts.a + c.counts.c}
                        </span>
                      ) : (
                        "–"
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && weekendGaps && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="t-small muted flex-1">{t.weekend.lead}</p>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onSuggest}>
            <Icon name="sparkle" className="size-5" />
            {t.weekend.suggest}
          </Button>
        </div>
      )}
      {cakeLine}
    </Card>
  );
}

function CakeLine({
  cake,
  canEdit,
  onChange,
}: {
  cake: NonNullable<MenuView["cake"]>;
  canEdit: boolean;
  onChange: () => void;
}) {
  return (
    <div className="nb-sm tone-yellow flex flex-wrap items-center gap-3 p-4">
      <Icon name="cake" className="size-6 shrink-0" />
      <p className="t-ui flex-1">
        <b>{t.cake(fr.days[cake.day - 1]!)}</b> {cake.name.toLowerCase()} · {cake.parts}
      </p>
      {canEdit && (
        <Button type="button" variant="outline" size="sm" onClick={onChange}>
          {t.change}
        </Button>
      )}
    </div>
  );
}

/** Un plat de la semaine : la ligne s'ouvre sur sa recette, les retours et « Changer » restent visibles. */
function DishRow({
  dish,
  recipe,
  canEdit,
  pending,
  onFeedback,
  onDouble,
  onSwap,
}: {
  dish: DishCard;
  recipe: MenuView["recipes"][number] | null;
  canEdit: boolean;
  pending: boolean;
  onFeedback: (a: FeedbackAction) => void;
  onDouble: () => void;
  onSwap: () => void;
}) {
  const head = (
    <>
      {dish.photo && (
        <RecipeImage photo={dish.photo} sizes="96px" decorative className="nb-flat w-24 shrink-0" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {recipe && <span className="t-kicker">{recipe.title}</span>}
        <b className="t-3">
          <Flag flag={dish.flag} />
          {dish.name}
        </b>
        <span className="t-small flex flex-wrap items-center gap-x-3 gap-y-1 font-normal">
          <span className="mono">{dish.detail}</span>
          {recipe?.cost && (
            <span className="mono muted" data-testid="recipe-cost">
              {recipe.cost}
            </span>
          )}
          {recipe && (
            <span
              className="diff"
              role="img"
              aria-label={`${tv.difficulty.label(recipe.difficulty)} : ${tv.difficulty.levels[recipe.difficulty - 1]}`}
            >
              {[1, 2, 3, 4].map((n) => (
                <span key={n} aria-hidden="true" className={n <= recipe.difficulty ? "on" : ""} />
              ))}
            </span>
          )}
        </span>
      </span>
    </>
  );
  return (
    <li className="faq recipe-zoom">
      {recipe ? (
        <details>
          <summary>
            {head}
            <Icon name="chevronDown" />
          </summary>
          <div className="faq-body flex flex-col gap-3">
            <p className="t-3">{recipe.name}</p>
            {recipe.description && <p className="muted">{recipe.description}</p>}
            <h3 className="t-3">{t.ingredients}</h3>
            <ul className="list-disc pl-4">
              {recipe.ingredients.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3 className="t-3">{t.steps}</h3>
            <ol className="list-decimal pl-4">
              {recipe.steps.map((x, j) => (
                <li key={j}>{x}</li>
              ))}
            </ol>
            {recipe.notes.map((n) => (
              <p key={n} className="t-small muted">
                {n}
              </p>
            ))}
          </div>
        </details>
      ) : (
        <div className="flex items-center gap-4 px-4 py-3">{head}</div>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 border-t-[length:var(--bw)] border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.feedbackHint}>
            <button
              type="button"
              aria-pressed={dish.rating === 1}
              aria-label={t.like(dish.name)}
              disabled={pending}
              onClick={() => onFeedback("redo")}
              className={`chiptg ${dish.rating === 1 ? "[background:var(--green)]" : ""}`}
            >
              <Icon name="thumbUp" className="size-5" />
              {t.likeShort}
            </button>
            <button
              type="button"
              aria-pressed={dish.kids}
              aria-label={t.kids(dish.name)}
              disabled={pending}
              onClick={() => onFeedback("kids")}
              className={`chiptg ${dish.kids ? "[background:var(--green)]" : ""}`}
            >
              {t.kidsShort}
            </button>
            <button
              type="button"
              aria-pressed={dish.long}
              aria-label={t.tooLong(dish.name)}
              disabled={pending}
              onClick={() => onFeedback("long")}
              className={`chiptg ${dish.long ? "[background:var(--peach)]" : ""}`}
            >
              {t.tooLongShort}
            </button>
            <button
              type="button"
              aria-pressed={dish.rating === -1}
              aria-label={t.dislike(dish.name)}
              disabled={pending}
              onClick={() => onFeedback("refuse")}
              className={`iconbtn ${dish.rating === -1 ? "[background:var(--peach)]" : ""}`}
            >
              <Icon name="thumbDown" className="size-5" />
            </button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {dish.canDouble && (
              <button
                type="button"
                aria-pressed={dish.doubled}
                disabled={pending}
                onClick={onDouble}
                className="chiptg"
              >
                {t.double}
              </button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onSwap}
              aria-label={`${t.change} ${dish.name}`}
            >
              {t.change}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
