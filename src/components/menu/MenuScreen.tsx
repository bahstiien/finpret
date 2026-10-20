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
import { Flag } from "./Flag";
import { GuestsSheet, MoveSheet, RecipePickerSheet } from "./Sheets";
import { useMenuAction } from "./useMenuAction";

const t = fr.menuScreen;

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

export type CanteenEntry = { name: string; text: string; duplicates: string[] };

function CanteenBlock({ entry }: { entry: CanteenEntry }) {
  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface p-5" data-testid="canteen-today">
      <h3 className="text-sm font-semibold text-muted">{fr.canteen.today(entry.name)}</h3>
      <p className="font-bold">{entry.text}</p>
      {entry.duplicates.length > 0 && (
        <p className="rounded-2xl bg-peach px-3 py-2 text-sm font-semibold text-peach-ink" role="note" data-testid="canteen-duplicate">
          {fr.canteen.duplicate(entry.duplicates.join(", "))}
        </p>
      )}
    </section>
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
  const [sheet, setSheet] = useState<Sheet>(null);
  const { run, pending } = useMenuAction();
  const day = view.days[selected - 1]!;
  const today = inWeek ? view.days[view.todayIndex - 1] : null;
  const tonightName = today?.meals.find((m) => m.meal === "dinner" && !m.removed)?.name;

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted first-letter:uppercase">{header.date}</p>
          <h1 className="text-4xl font-black [overflow-wrap:anywhere]">
            {header.greeting}, <span className="break-words">{header.name}</span>
          </h1>
          {tonightName && (
            <p className="text-muted">
              {t.tonightLead} <b className="text-ink">{tonightName.toLowerCase()}</b>
            </p>
          )}
        </div>
        <Link
          href={`/app/print?week=${view.start}`}
          aria-label={t.print}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-surface"
        >
          <Icon name="print" />
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold" data-testid="week-title">
          {fr.menu.weekOf(formatShort(view.start))}
        </h2>
        {weeks.hasNext && (
          <Link
            href="/app?week=next"
            className="rounded-pill bg-violet px-4 py-2 text-sm font-bold text-white"
          >
            {t.nextWeek}
          </Link>
        )}
        {weeks.hasCurrent && (
          <Link href="/app" className="rounded-pill bg-surface px-4 py-2 text-sm font-bold">
            {t.currentWeek}
          </Link>
        )}
      </div>

      <div className="grid gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-5">
          <DayStrip view={view} selected={selected} onSelect={setSelected} />
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

        <div className="flex flex-col gap-5">
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
          <section className="flex flex-col gap-4 rounded-card bg-violet p-6 text-white">
            <span className="self-start rounded-pill border border-white/40 px-3 py-1 text-xs font-bold">
              {t.weekend.eyebrow}
            </span>
            <h2 className="text-2xl font-black">{t.weekend.title}</h2>
            <p className="text-white">{t.weekend.lead}</p>
            {view.weekend.length > 0 && (
              <ul className="flex flex-col gap-1">
                {view.weekend.map((w) => (
                  <li key={w.key}>
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
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => suggestWeekendAction(view.weekId))}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-surface px-6 font-bold text-ink"
              >
                <Icon name="sparkle" className="size-5" />
                {t.weekend.suggest}
              </button>
            )}
          </section>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-black">{t.dishes}</h2>
          <span className="text-sm text-muted">{t.dishCount(view.dishes.length)}</span>
        </div>
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2" data-testid="dishes">
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

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-black">{t.recipes}</h2>
        {view.recipes.map((r, i) => (
          <details key={i} className="rounded-card bg-surface p-5">
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-violet-strong uppercase">{r.title}</span>
              <b className="text-lg">
                <Flag flag={r.flag} />
                {r.name}
              </b>
              <span className="text-sm text-muted">{r.portions}</span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {r.description && <p className="text-muted">{r.description}</p>}
              <h3 className="font-extrabold">{t.ingredients}</h3>
              <ul className="list-disc pl-5">
                {r.ingredients.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <h3 className="font-extrabold">{t.steps}</h3>
              <ol className="list-decimal pl-5">
                {r.steps.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ol>
              {r.notes.map((n) => (
                <p key={n} className="text-sm text-muted">
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
          <Link
            href="/settings/menu"
            className="inline-flex min-h-11 items-center rounded-pill bg-surface px-6 font-bold"
          >
            {t.quickSettings}
          </Link>
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

function DayStrip({
  view,
  selected,
  onSelect,
}: {
  view: MenuView;
  selected: number;
  onSelect: (d: number) => void;
}) {
  return (
    <nav aria-label={t.days} className="-mx-1 overflow-x-auto px-1">
      <ul className="grid grid-cols-7 gap-1.5">
        {view.days.map((d) => {
          const isToday = d.day === view.todayIndex;
          const past = view.todayIndex > d.day && view.todayIndex <= 7;
          const weekend = d.day > 5;
          return (
            <li key={d.day}>
              <button
                type="button"
                aria-pressed={selected === d.day}
                aria-label={`${fr.days[d.day - 1]} ${Number(d.iso.slice(8))}${isToday ? `, ${t.today}` : ""}`}
                onClick={() => onSelect(d.day)}
                className={`flex h-16 w-full flex-col items-center justify-center rounded-2xl border-2 font-display transition ${
                  isToday
                    ? "border-banana bg-banana text-[#17151F]"
                    : weekend
                      ? "border-banana bg-surface"
                      : "border-transparent bg-surface"
                } ${past && !isToday ? "text-muted" : ""} ${selected === d.day && !isToday ? "outline-3 outline-violet" : ""}`}
              >
                <span className="text-lg font-black">{Number(d.iso.slice(8))}</span>
                <span className="text-[0.7rem] font-bold">{fr.daysAbbr[d.day - 1]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
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
        <div className="flex flex-col gap-2 rounded-card bg-ink p-5 text-surface">
          <span className="grid size-10 place-items-center rounded-xl bg-banana text-[#17151F]">
            <Icon name="pot" />
          </span>
          <span className="text-sm text-surface/70">
            {isToday ? t.tiles.tonight : t.tiles.dayEvening(fr.days[day.day - 1]!)}
          </span>
          <b className="text-lg leading-tight">{day.tonight}</b>
        </div>
      )}
      {day.thaw.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card bg-yellow-soft p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-surface">
            <Icon name="snow" />
          </span>
          <span className="text-sm text-muted">{isToday ? t.tiles.beforeBed : t.tiles.eveBefore}</span>
          <b className="text-lg leading-tight">{t.tiles.thaw(day.thaw)}</b>
        </div>
      )}
      <div className="flex flex-col gap-1 rounded-card bg-blue-soft p-5 text-blue-ink">
        <span className="text-sm font-semibold">{t.tiles.session}</span>
        <b className="font-display text-3xl font-black">{dur(sessionMinutes)}</b>
      </div>
      <div className="flex flex-col gap-1 rounded-card bg-surface p-5">
        <span className="text-sm font-semibold text-muted">{t.tiles.planned}</span>
        <b className="font-display text-3xl font-black" data-testid="summary-meals">
          {planned}
        </b>
      </div>
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
    <section className="flex flex-col gap-4 rounded-card bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">{t.grid.title}</h2>
        <span className="flex gap-3 text-sm text-muted">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-violet" aria-hidden="true" /> {t.grid.batch}
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-banana" aria-hidden="true" /> {t.grid.weekend}
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
                className={`text-xs font-bold ${d === view.todayIndex ? "text-ink" : "text-muted"}`}
              >
                {fr.daysShort[d - 1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["lunch", "dinner"] as const).map((m) => (
            <tr key={m}>
              <th scope="row" className="pr-1 text-left text-xs font-semibold text-muted">
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
                        className={`grid h-11 w-full place-items-center rounded-xl border-2 border-banana text-xs font-bold ${
                          c.state === "set" ? "bg-banana text-[#17151F]" : "bg-surface"
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
                      className={`grid h-11 w-full place-items-center rounded-xl ${
                        on
                          ? d === view.todayIndex
                            ? "bg-ink text-surface"
                            : "bg-violet text-white"
                          : "bg-chip text-muted"
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
    </section>
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
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-yellow-soft p-4">
      <Icon name="cake" className="size-6 shrink-0" />
      <p className="flex-1">
        <b>{t.cake(fr.days[cake.day - 1]!)}</b> {cake.name.toLowerCase()} · {cake.parts}
      </p>
      {canEdit && (
        <button
          type="button"
          onClick={onChange}
          className="min-h-11 rounded-pill border-2 border-ink px-4 text-sm font-bold"
        >
          {t.change}
        </button>
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
    <li className="flex w-72 shrink-0 snap-start flex-col gap-3 rounded-card bg-surface p-5">
      <div>
        <b className="text-lg leading-tight">
          <Flag flag={dish.flag} />
          {dish.name}
        </b>
        <p className="text-sm text-muted">{dish.detail}</p>
      </div>
      {canEdit && (
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={dish.rating === 1}
            aria-label={t.like(dish.name)}
            disabled={pending}
            onClick={() => onRate(1)}
            className={`grid size-11 place-items-center rounded-full border-2 ${dish.rating === 1 ? "border-green bg-green-soft" : "border-transparent bg-chip"}`}
          >
            <Icon name="thumbUp" className="size-5" />
          </button>
          <button
            type="button"
            aria-pressed={dish.rating === -1}
            aria-label={t.dislike(dish.name)}
            disabled={pending}
            onClick={() => onRate(-1)}
            className={`grid size-11 place-items-center rounded-full border-2 ${dish.rating === -1 ? "border-peach-ink bg-peach" : "border-transparent bg-chip"}`}
          >
            <Icon name="thumbDown" className="size-5" />
          </button>
          {dish.canDouble && (
            <button
              type="button"
              aria-pressed={dish.doubled}
              disabled={pending}
              onClick={onDouble}
              className={`min-h-11 rounded-pill px-3 text-sm font-bold ${dish.doubled ? "bg-blue-soft text-blue-ink" : "bg-chip"}`}
            >
              {t.double}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={onSwap}
            aria-label={`${t.change} ${dish.name}`}
            className="min-h-11 flex-1 rounded-pill border-2 border-ink px-4 font-bold"
          >
            {t.change}
          </button>
        </div>
      )}
    </li>
  );
}
