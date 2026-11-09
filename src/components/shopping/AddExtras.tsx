"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import {
  classify,
  extrasOf,
  findExtra,
  type Habit,
  normalize,
  parseEntry,
  quickPicks,
  searchExtras,
} from "@/engine/extras";
import { fr } from "@/i18n/fr";

const t = fr.shopping.extras;

/** Article déjà sur la liste (du menu ou ajouté à la main), retrouvé par son nom. */
export type OnList = { id: string; checked: boolean; manual: boolean };

/**
 * Ajout d'articles hors menu (§8.3) : une recherche qui propose la bibliothèque et les habitudes du foyer
 * (rayon affiché avant d'ajouter), une saisie libre rangée automatiquement, des raccourcis d'un geste et la
 * bibliothèque à parcourir rayon par rayon. Un raccourci déjà sur la liste se retire d'un second geste.
 */
export function AddExtras({
  aisles,
  habits,
  onList,
  readOnly,
  onAdd,
  onRemove,
}: {
  aisles: { key: string; label: string }[];
  habits: Habit[];
  /** Articles de la liste, par nom normalisé. */
  onList: Map<string, OnList>;
  readOnly: boolean;
  onAdd: (label: string, qty: string, aisle: string) => void;
  onRemove: (id: string) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const [browsing, setBrowsing] = useState(false);
  const [browseAisle, setBrowseAisle] = useState(aisles.find((a) => a.key !== "divers")?.key ?? "divers");
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const aisleLabel = (k: string) => aisles.find((a) => a.key === k)?.label ?? fr.shopping.other;

  const entry = parseEntry(text);
  const suggestions = useMemo(() => searchExtras(entry.label, habits), [entry.label, habits]);
  // Nom exact ou autre écriture connue (« pq ») : pas de saisie libre en doublon, Entrée ajoute l'article connu.
  const exact = useMemo(() => findExtra(entry.label, habits), [entry.label, habits]);
  const free = entry.label && !exact ? { label: entry.label, aisle: classify(entry.label, habits) } : null;
  const options = [...suggestions, ...(free ? [{ ...free, from: "free" as const }] : [])];
  const open = text.trim().length > 0 && options.length > 0;
  const picks = useMemo(() => quickPicks(habits), [habits]);

  const status = (label: string) => onList.get(normalize(label));
  const pick = (o: { label: string; aisle: string }) => {
    const s = status(o.label);
    onAdd(o.label, entry.qty, o.aisle);
    toast(
      s && (!s.checked || !s.manual)
        ? s.manual
          ? t.alreadyOnList
          : t.fromMenu
        : t.added(o.label, aisleLabel(o.aisle)),
    );
    setText("");
    setActive(-1);
    input.current?.focus();
  };
  /** Raccourci : ajoute, ou retire s'il est déjà sur la liste et pas encore pris. */
  const toggle = (o: { label: string; aisle: string }) => {
    const s = status(o.label);
    if (s && !s.manual) toast(t.fromMenu);
    else if (s && !s.checked) onRemove(s.id);
    else onAdd(o.label, "", o.aisle);
  };

  const chip = (o: { label: string; aisle: string }, withAisle = false) => {
    const s = status(o.label);
    const pressed = !!s && !s.checked;
    return (
      <button
        key={`${o.aisle}-${o.label}`}
        type="button"
        aria-pressed={pressed}
        aria-label={
          pressed
            ? s.manual
              ? t.removeChip(o.label)
              : `${o.label} : ${t.fromMenu}`
            : t.addChip(o.label, aisleLabel(o.aisle))
        }
        disabled={readOnly}
        onClick={() => toggle(o)}
        className="chiptg"
        data-testid="extra-chip"
      >
        <Icon name={pressed ? "check" : "plus"} />
        {o.label}
        {withAisle && <span className="sr-only">, {aisleLabel(o.aisle)}</span>}
      </button>
    );
  };

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <div>
        <h2 className="t-3">{t.title}</h2>
        <p className="t-small muted">{t.hint}</p>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const o = active >= 0 ? options[active] : (exact ?? free);
          if (o) pick(o);
        }}
      >
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="item-label" className="sr-only">
              {fr.shopping.addLabel}
            </label>
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 muted"
            />
            <input
              ref={input}
              id="item-label"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
              autoComplete="off"
              enterKeyHint="done"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setActive(-1);
              }}
              onKeyDown={(e) => {
                if (!open) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => (i + 1) % options.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setText("");
                  setActive(-1);
                }
              }}
              placeholder={t.placeholder}
              maxLength={80}
              disabled={readOnly}
              className="input pl-11"
            />
          </div>
          <Button type="submit" disabled={readOnly || !entry.label}>
            {fr.shopping.add}
          </Button>
        </div>

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={t.suggestions}
            className="nb-flat flex flex-col divide-y-[length:var(--bw)] divide-line overflow-hidden"
          >
            {options.map((o, i) => {
              const s = status(o.label);
              const already = !!s && !s.checked;
              return (
                <li
                  key={`${o.from}-${o.label}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={already || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => !already && pick(o)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? "tone-chip" : "bg-[var(--surface)]"} ${already ? "cursor-default" : ""}`}
                >
                  <Icon name={already ? "check" : "plus"} className="size-5 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="t-ui font-semibold [overflow-wrap:anywhere]">
                      {o.from === "free" ? t.freeEntry(o.label) : o.label}
                      {entry.qty && !already && <span className="mono muted"> · {entry.qty}</span>}
                    </span>
                    <span className="t-small muted">
                      {already
                        ? t.alreadyOnList
                        : o.from === "habit"
                          ? t.habit
                          : o.from === "free"
                            ? t.freeHint
                            : null}
                    </span>
                  </span>
                  <span className="pill shrink-0">{aisleLabel(o.aisle)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      {!open && (
        <div className="flex flex-col gap-2">
          <p className="t-kicker">{habits.length ? t.usual : t.popular}</p>
          <div className="flex flex-wrap gap-2">{picks.map((p) => chip(p, true))}</div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={browsing}
          aria-controls="extras-browse"
          onClick={() => setBrowsing((b) => !b)}
          className="t-ui flex min-h-11 cursor-pointer items-center gap-2 self-start border-0 bg-transparent p-0 font-bold underline underline-offset-4"
        >
          <Icon name="chevronDown" className={`size-4 ${browsing ? "rotate-180" : ""}`} />
          {browsing ? t.browseClose : t.browse}
        </button>
        {browsing && (
          <div id="extras-browse" className="flex flex-col gap-3">
            <div
              role="tablist"
              aria-label={t.browseAisles}
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
            >
              {aisles.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="tab"
                  aria-selected={a.key === browseAisle}
                  aria-controls="extras-aisle"
                  onClick={() => setBrowseAisle(a.key)}
                  className={`pill min-h-11 shrink-0 cursor-pointer px-3.5 ${a.key === browseAisle ? "tone-dark" : ""}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div
              id="extras-aisle"
              role="tabpanel"
              aria-label={aisleLabel(browseAisle)}
              className="flex flex-wrap gap-2"
            >
              {extrasOf(browseAisle).map((e) => chip(e))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
