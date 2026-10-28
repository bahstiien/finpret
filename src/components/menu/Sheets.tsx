"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/Controls";
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
import type { MenuView } from "@/server/menu-view";
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
  shortcuts,
  childFactor,
  onClose,
}: {
  weekId: string;
  day: number;
  meal: "lunch" | "dinner";
  initial: { a: number; c: number };
  custom: boolean;
  shortcuts: { family: { a: number; c: number }; adults: { a: number; c: number } };
  childFactor: number;
  onClose: () => void;
}) {
  const [g, setG] = useState(initial);
  const { run, pending } = useMenuAction();
  const parts = g.a + g.c * childFactor;
  const tile = (key: "a" | "c", label: string, tone: string) => (
    <div className={`flex flex-col items-center gap-3 rounded-card p-4 ${tone}`}>
      <span className="font-bold">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${label} : moins`}
          disabled={g[key] <= 0}
          onClick={() => setG({ ...g, [key]: g[key] - 1 })}
          className="grid size-11 place-items-center rounded-full bg-surface text-xl font-bold disabled:opacity-40"
        >
          −
        </button>
        <output aria-live="polite" className="font-display text-3xl font-bold">
          {g[key]}
        </output>
        <button
          type="button"
          aria-label={`${label} : plus`}
          disabled={g[key] >= 20}
          onClick={() => setG({ ...g, [key]: g[key] + 1 })}
          className="grid size-11 place-items-center rounded-full bg-surface text-xl font-bold"
        >
          +
        </button>
      </div>
    </div>
  );
  return (
    <Sheet open onClose={onClose} title={t.guests.title(slotLabel(`${day}-${meal}`))}>
      <div className="grid grid-cols-2 gap-3">
        {tile("a", t.guests.adults, "bg-blue-soft text-blue-ink")}
        {tile("c", t.guests.children, "bg-pink-soft text-pink-ink")}
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
      {!targets && !error && <p className="text-muted">{t.loading}</p>}
      {targets && (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t.move.legend}</legend>
          {targets.map((x) => (
            <label
              key={x.key}
              className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2 ${x.ok ? "cursor-pointer bg-bg" : "bg-bg opacity-50"} ${choice === x.key ? "outline-3 outline-violet" : ""}`}
            >
              <input
                type="radio"
                name="target"
                value={x.key}
                disabled={!x.ok}
                checked={choice === x.key}
                onChange={() => setChoice(x.key)}
                className="size-5 accent-violet"
              />
              <span className="flex flex-col">
                <b className="first-letter:uppercase">{slotLabel(x.key)}</b>
                <span className="text-sm text-muted">{nameAt(x.key) ?? fr.menu.nothing}</span>
                {!x.ok && x.reason && <span className="text-sm text-peach-ink">{x.reason}</span>}
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
  onClose,
}: {
  mode: "weekend" | "cake";
  weekId: string;
  slot: string;
  options: PickerOption[];
  current: string | null;
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
  const list = useMemo(() => {
    const q = normalize(query.trim());
    return options
      .filter((o) => !q || normalize(o.name).includes(q))
      .filter((o) => {
        if (filter === "ideas" || filter === "seasonal") return o.seasonal;
        if (filter === "quick") return o.quick;
        if (filter === "favorites") return o.favorite;
        if (filter.startsWith("type:")) return o.type === filter.slice(5);
        return true;
      })
      .slice(0, 60);
  }, [options, query, filter]);
  const chosen = options.find((o) => o.id === choice);
  const filters =
    mode === "weekend"
      ? (["ideas", "quick", "favorites", "all"] as const).map((f) => ({ key: f, label: t.picker.filters[f] }))
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
      <label htmlFor="picker-search" className="sr-only">
        {t.picker.search}
      </label>
      <input
        id="picker-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.picker.search}
        className="min-h-11 rounded-2xl border-2 border-line bg-surface px-4 focus:border-violet focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <ChipToggle key={f.key} pressed={filter === f.key} onToggle={() => setFilter(f.key)}>
            {f.label}
          </ChipToggle>
        ))}
        {mode === "cake" && (
          <ChipToggle
            pressed={false}
            onToggle={() => list.length && setChoice(list[Math.floor(Math.random() * list.length)]!.id)}
          >
            {t.picker.random}
          </ChipToggle>
        )}
      </div>
      <fieldset className="flex max-h-[40dvh] flex-col gap-1 overflow-y-auto">
        <legend className="sr-only">{t.picker.legend}</legend>
        {list.length === 0 && <p className="text-muted">{t.picker.empty}</p>}
        {list.map((o) => (
          <label
            key={o.id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 ${choice === o.id ? "bg-yellow-soft" : "hover:bg-chip"}`}
          >
            <input
              type="radio"
              name="recipe"
              value={o.id}
              checked={choice === o.id}
              onChange={() => setChoice(o.id)}
              className="size-5 accent-violet"
            />
            <span>
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
