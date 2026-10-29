"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { dur } from "@/engine/format";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import {
  prepareWeekAction,
  rateAction,
  suggestWeekendAction,
  swapDish,
  toggleDoubleAction,
  toggleGridSlot,
} from "@/server/actions/menu";
import type { DishCard, MenuView } from "@/server/menu-view";
import { DayProgram } from "./DayProgram";
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
  type: string;
};

export type CanteenEntry = {
  name: string;
  text: string;
  duplicates: string[];
  note?: string | null;
  edited?: boolean;
};

function CanteenBlock({ entry }: { entry: CanteenEntry }) {
  return (
    <Card padding="cozy" className="flex flex-col gap-2" data-testid="canteen-today">
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
    </Card>
  );
}

type Sheet =
  | {
      kind: "guests";
      day: number;
      meal: "lunch" | "dinner";
      counts: { a: number; c: number };
      custom: boolean;
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
}) {
  const inWeek = view.todayIndex >= 1 && view.todayIndex <= 7;
  const [selected, setSelected] = useState(inWeek ? view.todayIndex : 1);
  const [filter, setFilter] = useState<BoardFilter>("week");
  const [sheet, setSheet] = useState<Sheet>(null);
  const { run, pending } = useMenuAction();
  const day = view.days[selected - 1]!;
  const today = inWeek ? view.days[view.todayIndex - 1] : null;
  const tonightName = today?.meals.find((m) => m.meal === "dinner" && !m.removed)?.name;

  return (
    <>
      <div className="ph">
        <div className="flex flex-col gap-2.5">
          <p className="t-kicker first-letter:uppercase" data-testid="week-title">
            {fr.menu.weekOf(formatShort(view.start))}
          </p>
          <h1 className="t-1 [overflow-wrap:anywhere]">{t.title}</h1>
          {tonightName && (
            <p className="t-small muted">
              {header.greeting}, {header.name}. {t.tonightLead} <b className="text-ink">{tonightName.toLowerCase()}</b>
            </p>
          )}
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

      <Card tone="peach" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="t-kicker">{t.sessionBanner.kicker}</p>
          <p className="t-2">{t.sessionBanner.title(view.plannedMeals, dur(sessionMinutes))}</p>
        </div>
        <LinkButton href="/app/session" size="lg">
          {t.sessionBanner.go}
        </LinkButton>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg" role="group" aria-label={t.filter.label}>
          {(["week", "lunch", "dinner", "weekend"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t.filter[f]}
            </button>
          ))}
        </div>
        <p className="t-kicker muted">{t.board.meals(view.plannedMeals)}</p>
      </div>

      <WeekBoard view={view} filter={filter} selected={selected} onSelect={setSelected} />

      <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-4">
          <DayProgram
            day={day}
            isToday={selected === view.todayIndex}
            canEdit={canEdit}
            cake={view.cake && view.cake.day === selected ? view.cake : null}
            onMove={(from) => setSheet({ kind: "move", from })}
            onGuests={(m) =>
              setSheet({ kind: "guests", day: m.day, meal: m.meal, counts: m.counts, custom: m.guestsCustom })
            }
            weekId={view.weekId}
          />
          {(canteen[day.iso] ?? []).map((c) => (
            <CanteenBlock key={c.name} entry={c} />
          ))}
          <Tiles
            day={day}
            isToday={selected === view.todayIndex}
            sessionMinutes={sessionMinutes}
            planned={view.plannedMeals}
          />
        </div>

        <div className="flex flex-col gap-4">
          <PlanGrid
            view={view}
            canEdit={canEdit}
            pending={pending}
            onToggle={(d, m) => run(() => toggleGridSlot(view.weekId, d, m))}
            onWeekend={(key) => setSheet({ kind: "weekend", key })}
            cakeLine={
              view.cake ? (
                <CakeLine cake={view.cake} canEdit={canEdit} onChange={() => setSheet({ kind: "cake" })} />
              ) : null
            }
          />
          <Card tone="violet" className="flex flex-col gap-4">
            <span className="sticker tone-banane self-start">{t.weekend.eyebrow}</span>
            <h2 className="t-2">{t.weekend.title}</h2>
            <p>{t.weekend.lead}</p>
            {view.weekend.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {view.weekend.map((w) => (
                  <li key={w.key} className="t-ui">
                    <b>
                      {fr.days[w.day - 1]} {fr.meals[w.meal].toLowerCase()}
                    </b>{" "}
                    : <Flag flag={w.flag} />
                    {w.name}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="primary"
                disabled={pending}
                onClick={() => run(() => suggestWeekendAction(view.weekId))}
                className="self-start"
              >
                <Icon name="sparkle" className="size-5" />
                {t.weekend.suggest}
              </Button>
            )}
          </Card>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader title={t.dishes} aside={<span className="mono">{t.dishCount(view.dishes.length)}</span>} />
        <ul
          className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-1 pb-4 min-[900px]:mx-0 min-[900px]:px-0"
          data-testid="dishes"
        >
          {view.dishes.map((d) => (
            <DishCardView
              key={`${d.kind}-${d.index}`}
              dish={d}
              canEdit={canEdit}
              pending={pending}
              onRate={(v) => run(() => rateAction(view.weekId, d.recipeId, v))}
              onDouble={() => run(() => toggleDoubleAction(view.weekId, d.index))}
              onSwap={() => run(() => swapDish(view.weekId, d.kind, d.index))}
            />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title={t.recipes} />
        {view.recipes.map((r, i) => (
          <details key={i} className="faq">
            <summary>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="t-kicker">{r.title}</span>
                <b className="t-3">
                  <Flag flag={r.flag} />
                  {r.name}
                </b>
                <span className="t-small mono">{r.portions}</span>
                <span
                  className="diff"
                  role="img"
                  aria-label={`${tv.difficulty.label(r.difficulty)} : ${tv.difficulty.levels[r.difficulty - 1]}`}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <span key={n} aria-hidden="true" className={n <= r.difficulty ? "on" : ""} />
                  ))}
                </span>
              </span>
              <Icon name="chevronDown" />
            </summary>
            <div className="faq-body flex flex-col gap-3">
              {r.description && <p className="muted">{r.description}</p>}
              <h3 className="t-3">{t.ingredients}</h3>
              <ul className="list-disc pl-4">
                {r.ingredients.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <h3 className="t-3">{t.steps}</h3>
              <ol className="list-decimal pl-4">
                {r.steps.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ol>
              {r.notes.map((n) => (
                <p key={n} className="t-small muted">
                  {n}
                </p>
              ))}
            </div>
          </details>
        ))}
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

function Tiles({
  day,
  isToday,
  sessionMinutes,
  planned,
}: {
  day: MenuView["days"][number];
  isToday: boolean;
  sessionMinutes: number;
  planned: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="week-summary">
      {day.tonight && (
        <Card as="div" tone="dark" padding="cozy" className="flex flex-col gap-2">
          <span className="nb-sm tone-banane grid size-10 place-items-center">
            <Icon name="pot" />
          </span>
          <span className="t-label">{isToday ? t.tiles.tonight : t.tiles.dayEvening(fr.days[day.day - 1]!)}</span>
          <b className="t-3">{day.tonight}</b>
        </Card>
      )}
      {day.thaw.length > 0 && (
        <Card as="div" tone="yellow" padding="cozy" className="flex flex-col gap-2">
          <span className="nb-sm tone-surface grid size-10 place-items-center">
            <Icon name="snow" />
          </span>
          <span className="t-label">{isToday ? t.tiles.beforeBed : t.tiles.eveBefore}</span>
          <b className="t-3">{t.tiles.thaw(day.thaw)}</b>
        </Card>
      )}
      <Card as="div" tone="blue" padding="cozy" className="flex flex-col gap-1">
        <span className="t-label">{t.tiles.session}</span>
        <b className="num-l">{dur(sessionMinutes)}</b>
      </Card>
      <Card as="div" padding="cozy" className="flex flex-col gap-1">
        <span className="t-label">{t.tiles.planned}</span>
        <b className="num-l" data-testid="summary-meals">
          {planned}
        </b>
      </Card>
    </div>
  );
}

function PlanGrid({
  view,
  canEdit,
  pending,
  onToggle,
  onWeekend,
  cakeLine,
}: {
  view: MenuView;
  canEdit: boolean;
  pending: boolean;
  onToggle: (d: number, m: "lunch" | "dinner") => void;
  onWeekend: (key: string) => void;
  cakeLine: React.ReactNode;
}) {
  const cell = (d: number, m: "lunch" | "dinner") => view.grid.find((c) => c.day === d && c.meal === m)!;
  return (
    <Card padding="cozy" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-2">{t.grid.title}</h2>
        <span className="t-small flex gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-3 border-[length:var(--bw)] border-line bg-violet" aria-hidden="true" /> {t.grid.batch}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 border-[length:var(--bw)] border-line bg-banane" aria-hidden="true" /> {t.grid.weekend}
          </span>
        </span>
      </div>
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th />
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <th
                key={d}
                scope="col"
                className={`t-label ${d === view.todayIndex ? "tone-banane" : ""}`}
              >
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
                return (
                  <td key={d}>
                    <button
                      type="button"
                      disabled={!canEdit || pending}
                      aria-pressed={on}
                      onClick={() => onToggle(d, m)}
                      aria-label={on ? t.grid.on(slot, c.name ?? "") : t.grid.off(slot)}
                      className={`mono grid h-11 w-full place-items-center rounded-r1 border-[length:var(--bw)] border-line ${
                        on ? (d === view.todayIndex ? "tone-dark" : "tone-violet") : "tone-chip muted"
                      }`}
                    >
                      {on ? <Icon name="check" className="size-5" /> : "–"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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

function DishCardView({
  dish,
  canEdit,
  pending,
  onRate,
  onDouble,
  onSwap,
}: {
  dish: DishCard;
  canEdit: boolean;
  pending: boolean;
  onRate: (v: 1 | -1) => void;
  onDouble: () => void;
  onSwap: () => void;
}) {
  return (
    <Card as="li" padding="cozy" className="flex w-72 shrink-0 snap-start flex-col gap-3">
      <div>
        <b className="t-3">
          <Flag flag={dish.flag} />
          {dish.name}
        </b>
        <p className="t-small muted">{dish.detail}</p>
      </div>
      {canEdit && (
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={dish.rating === 1}
            aria-label={t.like(dish.name)}
            disabled={pending}
            onClick={() => onRate(1)}
            className={`iconbtn ${dish.rating === 1 ? "[background:var(--green)]" : ""}`}
          >
            <Icon name="thumbUp" className="size-5" />
          </button>
          <button
            type="button"
            aria-pressed={dish.rating === -1}
            aria-label={t.dislike(dish.name)}
            disabled={pending}
            onClick={() => onRate(-1)}
            className={`iconbtn ${dish.rating === -1 ? "[background:var(--peach)]" : ""}`}
          >
            <Icon name="thumbDown" className="size-5" />
          </button>
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
            className="flex-1"
          >
            {t.change}
          </Button>
        </div>
      )}
    </Card>
  );
}
