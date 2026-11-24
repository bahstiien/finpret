"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/Layout";
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
import type { DishCard, MenuView } from "@/server/menu-view";
import { WeekBoard } from "./WeekBoard";
import { Flag } from "./Flag";
import { GuestsSheet, MoveSheet, RecipePickerSheet, RecipeSheet } from "./Sheets";
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
      /** Ouverte depuis la grille : propose aussi « Déplacer » et « Ne rien prévoir ». */
      fromGrid?: boolean;
    }
  | { kind: "move"; from: string }
  | { kind: "weekend"; key: string; batch?: "add" | "restore" }
  | { kind: "cake" }
  | { kind: "recipe"; recipeId: string }
  | null;

/** « Cette semaine » : lecture du jour (carrousel) ; « Organiser » : grille des repas et plats à changer. */
export type MenuMode = "eat" | "prep";

export function MenuScreen({
  header,
  view,
  canEdit,
  frozen = false,
  sessionMinutes,
  weekendOptions,
  cakeOptions,
  shortcuts,
  childFactor,
  weeks,
  canteen = {},
  initialMode,
  topSlot,
  hideBanner = false,
  dayTip,
}: {
  header: { date: string; greeting: string; name: string };
  view: MenuView;
  canEdit: boolean;
  /** Session lancée : la semaine est figée, ses boutons de modification disparaissent. */
  frozen?: boolean;
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
  initialMode: MenuMode;
  /** Carte d'aide de la prise en main ; `hideBanner` : elle prend la place du bandeau (une seule carte d'action). */
  topSlot?: React.ReactNode;
  hideBanner?: boolean;
  dayTip?: React.ReactNode;
}) {
  const inWeek = view.todayIndex >= 1 && view.todayIndex <= 7;
  const [selected, setSelected] = useState(inWeek ? view.todayIndex : 1);
  const [sheet, setSheet] = useState<Sheet>(null);
  const { run, pending } = useMenuAction();
  // Semaine figée (session lancée) : plus de bouton de modification, seulement la lecture et les retours.
  const editable = canEdit && !frozen;
  const [chosen, setMode] = useState<MenuMode>(initialMode);
  const mode: MenuMode = editable ? chosen : "eat";
  const today = inWeek ? view.days[view.todayIndex - 1] : null;
  // Alerte doublon cantine / dîner (§13) : un bandeau par jour concerné, « Changer » sur le plat du soir.
  const alerts = view.days.flatMap((d) => {
    const groups = [...new Set((canteen[d.iso] ?? []).flatMap((c) => c.duplicates))];
    if (!groups.length) return [];
    const dinner = d.meals.find((m) => m.meal === "dinner" && !m.removed);
    return [{ day: d.day, groups, dinner: dinner && dinner.kind !== "weekend" ? dinner : null }];
  });
  const tonightName = today?.meals.find((m) => m.meal === "dinner" && !m.removed)?.name;
  // Retours : seulement pour un plat déjà servi (jusqu'à aujourd'hui inclus).
  const eaten = (recipeId: string) =>
    view.days.some(
      (d) => d.day <= view.todayIndex && d.meals.some((m) => m.recipeId === recipeId && !m.removed),
    );
  const recipeOf = (id: string) => view.recipes.find((r) => r.recipeId === id) ?? null;
  const open = (recipeId: string) => {
    if (recipeOf(recipeId)) setSheet({ kind: "recipe", recipeId });
  };
  const dishActions = (d: DishCard, after?: () => void) => (
    <DishActions
      dish={d}
      pending={pending}
      onDouble={() => run(() => toggleDoubleAction(view.weekId, d.index))}
      onSwap={() => run(() => swapDish(view.weekId, d.kind, d.index), after)}
    />
  );
  const openRecipe = sheet?.kind === "recipe" ? recipeOf(sheet.recipeId) : null;
  const openDish =
    openRecipe && mode === "prep" ? view.dishes.find((d) => d.recipeId === openRecipe.recipeId) : undefined;
  const banner =
    weeks.canPrepareNext && canEdit ? (
      <Card
        tone="peach"
        className="flex flex-wrap items-center justify-between gap-4"
        data-testid="next-week"
      >
        <div className="flex flex-col gap-1.5">
          <p className="t-kicker">{t.nextBanner.kicker}</p>
          <p className="t-2">{t.nextBanner.title}</p>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={() => run(() => prepareWeekAction(weeks.nextStart))}
        >
          {t.prepareNext}
        </Button>
      </Card>
    ) : (
      <Card
        tone="peach"
        className="flex flex-wrap items-center justify-between gap-4"
        data-testid="week-summary"
      >
        <div className="flex flex-col gap-1.5">
          <p className="t-kicker">{t.sessionBanner.kicker}</p>
          <p className="t-2">{t.sessionBanner.title(dur(sessionMinutes))}</p>
        </div>
        <LinkButton href="/app/session" size="lg">
          {t.sessionBanner.go}
        </LinkButton>
      </Card>
    );

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
          <MoreMenu
            printHref={`/app/print?week=${view.start}`}
            onRegenerate={
              editable
                ? () => {
                    if (window.confirm(t.regenerateConfirm)) run(() => prepareWeekAction(view.start));
                  }
                : null
            }
            settings={canEdit}
          />
        </div>
      </div>

      {topSlot}
      {!hideBanner && banner}

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
          {editable && a.dinner && (
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

      {editable && (
        <div className="seg self-start" role="group" aria-label={t.mode.label} data-testid="menu-mode">
          {(["eat", "prep"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {t.mode[m]}
            </button>
          ))}
        </div>
      )}

      {dayTip}

      {mode === "eat" ? (
        <WeekBoard
          view={view}
          selected={selected}
          onSelect={setSelected}
          onOpen={open}
          extraFor={(d) =>
            (canteen[d.iso] ?? []).map((c) => (
              <CanteenBlock key={c.name} entry={c} current={d.day === selected} />
            ))
          }
        />
      ) : (
        <>
          <div className="max-w-3xl">
            <PlanGrid
              view={view}
              canEdit={editable}
              pending={pending}
              onGuests={(c) =>
                setSheet({
                  kind: "guests",
                  day: c.day,
                  meal: c.meal,
                  counts: c.counts,
                  custom: c.custom,
                  fromGrid: true,
                })
              }
              onWeekend={(key, batch) => setSheet({ kind: "weekend", key, batch })}
              onSuggest={() => run(() => suggestWeekendAction(view.weekId))}
              cakeLine={
                view.cake ? (
                  <CakeLine cake={view.cake} canEdit={editable} onChange={() => setSheet({ kind: "cake" })} />
                ) : null
              }
            />
          </div>

          <section id="plats" className="flex scroll-mt-4 flex-col gap-4">
            <SectionHeader
              title={t.dishes}
              aside={<span className="mono">{t.dishCount(view.dishes.length)}</span>}
            />
            <ul className="flex flex-col gap-3" data-testid="dishes">
              {view.dishes.map((d) => (
                <DishRow
                  key={`${d.kind}-${d.index}`}
                  dish={d}
                  onOpen={recipeOf(d.recipeId) ? () => open(d.recipeId) : undefined}
                  actions={dishActions(d)}
                />
              ))}
            </ul>
          </section>
        </>
      )}

      {openRecipe && (
        <RecipeSheet
          recipe={openRecipe}
          pending={pending}
          onFeedback={
            canEdit && eaten(openRecipe.recipeId)
              ? (a) => run(() => feedbackAction(view.weekId, openRecipe.recipeId, a))
              : undefined
          }
          actions={openDish && editable ? dishActions(openDish, () => setSheet(null)) : undefined}
          onClose={() => setSheet(null)}
        />
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
              ? () =>
                  run(
                    () => toggleGridSlot(view.weekId, sheet.day, sheet.meal),
                    () => setSheet(null),
                  )
              : undefined
          }
          onMove={
            sheet.fromGrid &&
            view.days[sheet.day - 1]?.meals.some(
              (m) => m.meal === sheet.meal && !m.removed && m.kind !== "weekend",
            )
              ? () => setSheet({ kind: "move", from: `${sheet.day}-${sheet.meal}` })
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
          batch={
            sheet.batch
              ? {
                  label: sheet.batch === "add" ? fr.sheets.picker.addBatch : fr.sheets.picker.restoreBatch,
                  onPick: () => {
                    const [d, m] = sheet.key.split("-") as [string, "lunch" | "dinner"];
                    run(
                      () => toggleGridSlot(view.weekId, Number(d), m),
                      () => setSheet(null),
                    );
                  },
                }
              : undefined
          }
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

/**
 * Actions rares de l'en-tête : imprimer, régénérer la semaine, réglages du menu. Simple liste dépliante (pas de
 * rôle `menu`, qui imposerait la navigation aux flèches) : Tab parcourt les actions, Échap referme.
 */
function MoreMenu({
  printHref,
  onRegenerate,
  settings,
}: {
  printHref: string;
  onRegenerate: (() => void) | null;
  settings: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        setOpen(false);
        // Le focus était peut-être dans la liste, qui disparaît : il revient sur le bouton.
        trigger.current?.focus();
      } else if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const item = "t-ui flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-3 text-left hover:bg-chip";
  return (
    <div
      ref={box}
      className="relative"
      // Tab au-delà de la dernière action : la liste se referme.
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="iconbtn"
        aria-expanded={open}
        aria-controls="menu-more"
        aria-label={t.more}
        onClick={() => setOpen(!open)}
      >
        <Icon name="more" />
      </button>
      {open && (
        <ul
          id="menu-more"
          className="nb absolute top-12 right-0 z-30 flex w-max flex-col gap-1 bg-surface p-2"
        >
          <li>
            <Link href={printHref} className={item}>
              <Icon name="print" className="size-5" />
              {t.print}
            </Link>
          </li>
          {onRegenerate && (
            <li>
              <button
                type="button"
                className={item}
                onClick={() => {
                  setOpen(false);
                  onRegenerate();
                }}
              >
                <Icon name="sparkle" className="size-5" />
                {fr.menu.regenerate}
              </button>
            </li>
          )}
          {settings && (
            <li>
              <Link href="/settings/menu" className={item}>
                <Icon name="sliders" className="size-5" />
                {t.quickSettings}
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function PlanGrid({
  view,
  canEdit,
  pending,
  onGuests,
  onWeekend,
  onSuggest,
  cakeLine,
}: {
  view: MenuView;
  canEdit: boolean;
  pending: boolean;
  onGuests: (c: MenuView["grid"][number]) => void;
  /** Choisir une recette pour un créneau ; `batch` : créneau de semaine à prévoir (ou remettre) avec le batch. */
  onWeekend: (key: string, batch?: "add" | "restore") => void;
  onSuggest: () => void;
  cakeLine: React.ReactNode;
}) {
  const cell = (d: number, m: "lunch" | "dinner") => view.grid.find((c) => c.day === d && c.meal === m)!;
  const weekendGaps = view.grid.some((c) => c.day > 5 && c.state === "empty");
  // Placement : écrit en entier pour Tailwind. Position d'un élément : ligne `d` (0 = en-têtes) et colonne `col` sur mobile, transposées dès 560 px.
  const pos =
    "[grid-row:var(--mr)] [grid-column:var(--mc)] min-[560px]:[grid-row:var(--dr)] min-[560px]:[grid-column:var(--dc)]";
  const at = (d: number, col: number) =>
    ({ "--mr": d + 1, "--mc": col, "--dr": col, "--dc": d + 1 }) as React.CSSProperties;
  return (
    <Card padding="cozy" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-2">
          {t.grid.title} · <span data-testid="summary-meals">{view.plannedMeals}</span> {t.board.mealsUnit}
        </h2>
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
      {/*
        Grille des repas : 7 colonnes (jours) dès 560 px ; en dessous, une ligne par jour et deux colonnes (midi, soir),
        pour garder des cases d'au moins 44 px. Chaque case porte son créneau dans son nom accessible.
      */}
      <div
        role="group"
        aria-label={t.grid.title}
        className="grid grid-cols-[auto_1fr_1fr] gap-1 min-[560px]:grid-cols-[auto_repeat(7,1fr)]"
      >
        {(["lunch", "dinner"] as const).map((m, i) => (
          <span
            key={m}
            aria-hidden="true"
            style={at(0, i + 2)}
            className={`${pos} t-label self-end text-center min-[560px]:self-center min-[560px]:pr-1 min-[560px]:text-left`}
          >
            {fr.meals[m]}
          </span>
        ))}
        {[1, 2, 3, 4, 5, 6, 7].flatMap((d) => [
          <span
            key={d}
            aria-hidden="true"
            style={at(d, 1)}
            className={`${pos} t-label grid place-items-center px-2 ${d === view.todayIndex ? "tone-banane" : ""}`}
          >
            {fr.daysAbbr[d - 1]}
          </span>,
          ...(["lunch", "dinner"] as const).map((m) => {
            const c = cell(d, m);
            const slot = `${fr.days[d - 1]} ${fr.meals[m].toLowerCase()}`;
            // Week-end cuisiné sur place ; préparé pendant la session, il se lit comme la semaine.
            if (d > 5 && (c.state === "set" || c.state === "empty")) {
              return (
                <button
                  key={`${d}-${m}`}
                  style={at(d, m === "lunch" ? 2 : 3)}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onWeekend(`${d}-${m}`)}
                  aria-label={c.name ? t.grid.weekendSet(slot, c.name) : t.grid.weekendEmpty(slot)}
                  className={`${pos} grid h-11 w-full place-items-center rounded-r1 border-[length:var(--bw)] border-line ${
                    c.state === "set" ? "tone-banane" : "tone-surface border-dashed"
                  }`}
                >
                  {c.state === "set" ? (
                    <Icon name="check" className="size-5" />
                  ) : canEdit ? (
                    <Icon name="plus" className="size-5" />
                  ) : (
                    "–"
                  )}
                </button>
              );
            }
            const on = c.state === "on";
            const replace = c.state === "removed";
            if (c.state === "set") {
              return (
                <button
                  key={`${d}-${m}`}
                  style={at(d, m === "lunch" ? 2 : 3)}
                  type="button"
                  disabled={!canEdit}
                  aria-haspopup="dialog"
                  onClick={() => onWeekend(`${d}-${m}`)}
                  aria-label={t.grid.weekendSet(slot, c.name ?? "")}
                  className={`${pos} grid h-11 w-full place-items-center rounded-r1 border-[length:var(--bw)] border-line tone-banane`}
                >
                  <Icon name="check" className="size-5" />
                </button>
              );
            }
            return (
              <button
                key={`${d}-${m}`}
                style={at(d, m === "lunch" ? 2 : 3)}
                type="button"
                disabled={!canEdit || pending}
                aria-pressed={on}
                aria-haspopup="dialog"
                onClick={() => (on ? onGuests(c) : onWeekend(`${d}-${m}`, replace ? "restore" : "add"))}
                aria-label={
                  on
                    ? t.grid.on(slot, c.name ?? "", c.counts.a + c.counts.c)
                    : replace
                      ? t.grid.removedCell(slot)
                      : t.grid.off(slot)
                }
                className={`${pos} mono grid h-11 w-full place-items-center rounded-r1 border-[length:var(--bw)] border-line ${
                  // Le jour courant est signalé par l'en-tête de colonne : le jaune reste celui du « jour même ».
                  on ? "tone-violet" : replace ? "tone-yellow border-dashed border-violet" : "tone-chip muted"
                }`}
              >
                {on ? (
                  <span
                    className={`text-base font-bold ${c.custom ? "underline decoration-2 underline-offset-4" : ""}`}
                  >
                    {c.counts.a + c.counts.c}
                  </span>
                ) : (
                  "–"
                )}
              </button>
            );
          }),
        ])}
      </div>
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

/** Un plat de la semaine : photo et nom ouvrent sa recette ; Doubler et Changer restent à portée. */
function DishRow({
  dish,
  onOpen,
  actions,
}: {
  dish: DishCard;
  onOpen?: () => void;
  actions: React.ReactNode;
}) {
  const head = (
    <>
      {dish.photo && (
        <RecipeImage photo={dish.photo} sizes="96px" decorative className="nb-flat w-20 shrink-0" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="t-3">
          <Flag flag={dish.flag} />
          {dish.name}
        </b>
        <span className="t-small mono">{dish.detail}</span>
      </span>
    </>
  );
  return (
    <li className="nb tone-surface flex flex-wrap items-center gap-3 p-3">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
        >
          <span className="sr-only">{t.openRecipeLead}</span>
          {head}
          <Icon name="chevronRight" className="shrink-0" />
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-4">{head}</span>
      )}
      {actions}
    </li>
  );
}

/** Doubler (pour le congélateur) et Changer : absents d'une semaine figée, l'appelant ne les rend pas. */
function DishActions({
  dish,
  pending,
  onDouble,
  onSwap,
}: {
  dish: DishCard;
  pending: boolean;
  onDouble: () => void;
  onSwap: () => void;
}) {
  return (
    <span className="ml-auto flex flex-wrap items-center gap-2">
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
    </span>
  );
}
