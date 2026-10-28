"use client";

import type { ReactNode } from "react";

/** Interrupteur oui / non (zone tactile de 44 px). */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-pill bg-line transition duration-300 ease-base peer-checked:bg-violet peer-focus-visible:outline-3 peer-focus-visible:outline-violet after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition duration-300 ease-base peer-checked:after:translate-x-5"
      />
    </label>
  );
}

/** Compteur avec − et +. */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const btn =
    "grid size-11 place-items-center rounded-full bg-chip text-xl font-bold disabled:opacity-40 hover:bg-line";
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          aria-label={`${label} : moins`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
        >
          −
        </button>
        <output
          aria-live="polite"
          className="min-w-14 text-center font-display text-lg font-bold whitespace-nowrap"
        >
          {format(value)}
        </output>
        <button
          type="button"
          className={btn}
          aria-label={`${label} : plus`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Pastille à cocher (allergènes, filtres). */
export function ChipToggle({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`min-h-11 rounded-pill px-4 text-sm font-semibold transition duration-300 ease-base ${
        pressed ? "bg-violet text-white" : "bg-chip text-ink hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

/** Grille 7 × 2 (ou 5 × 2) de cases à cocher par créneau. */
export function SlotGrid({
  days,
  dayLabels,
  mealLabels,
  isOn,
  onToggle,
  label,
}: {
  days: number[];
  dayLabels: readonly string[];
  mealLabels: { lunch: string; dinner: string };
  isOn: (day: number, meal: "lunch" | "dinner") => boolean;
  onToggle: (day: number, meal: "lunch" | "dinner") => void;
  label: (day: number, meal: "lunch" | "dinner", on: boolean) => string;
}) {
  return (
    <table className="w-full border-separate border-spacing-1.5">
      <thead>
        <tr>
          <th />
          {days.map((d) => (
            <th key={d} scope="col" className="text-xs font-bold text-muted">
              {dayLabels[d - 1]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(["lunch", "dinner"] as const).map((meal) => (
          <tr key={meal}>
            <th scope="row" className="pr-1 text-left text-sm font-semibold text-muted">
              {mealLabels[meal]}
            </th>
            {days.map((d) => {
              const on = isOn(d, meal);
              return (
                <td key={d}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={label(d, meal, on)}
                    onClick={() => onToggle(d, meal)}
                    className={`grid h-11 w-full min-w-9 place-items-center rounded-2xl text-lg font-bold transition duration-300 ease-base ${
                      on ? "bg-violet text-white" : "bg-chip text-muted"
                    }`}
                  >
                    {on ? "✓" : "–"}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
