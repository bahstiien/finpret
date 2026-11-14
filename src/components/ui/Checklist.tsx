"use client";

import { type ReactNode, useId } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { ProgressBar } from "./Layout";
import { Pill } from "./Pill";

export type ChecklistItem = {
  key: string;
  label: string;
  hint?: string;
  done: boolean;
  /** Libellé de l'étiquette « Facultatif ». */
  optionalLabel?: string;
  /** Texte lu par les lecteurs d'écran pour une étape faite. */
  doneLabel: string;
  /** Boutons de l'étape non faite. */
  actions?: ReactNode;
};

/**
 * Liste d'étapes qui se cochent seules, avec barre de progression et carte réductible.
 * Assemblage de `Card`, `ProgressBar`, `Pill` et `Icon` : aucun jeton nouveau (SPEC_PRISE_EN_MAIN §2, principe 6).
 */
export function Checklist({
  title,
  subtitle,
  progressText,
  progressLabel,
  value,
  items,
  collapsed,
  onToggle,
  toggleLabel,
  footer,
  testId = "checklist",
}: {
  title: string;
  subtitle?: string;
  progressText: string;
  progressLabel: string;
  value: number;
  items: ChecklistItem[];
  collapsed: boolean;
  onToggle: () => void;
  toggleLabel: string;
  footer?: ReactNode;
  testId?: string;
}) {
  const titleId = useId();
  const bodyId = useId();
  return (
    <Card aria-labelledby={titleId} data-testid={testId} className="page-enter flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={titleId} className="t-2">
          {title}
        </h2>
        <span className="t-ui mono muted" data-testid={`${testId}-progress`}>
          {progressText}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="ml-auto"
        >
          {toggleLabel}
        </Button>
      </div>
      <ProgressBar value={value} label={progressLabel} />
      <div id={bodyId} hidden={collapsed} className="flex flex-col gap-4">
        {subtitle && <p className="t-small muted">{subtitle}</p>}
        <ol className="flex flex-col divide-y-[length:var(--bw)] divide-line">
          {items.map((item) => (
            <li
              key={item.key}
              data-step={item.key}
              data-done={item.done}
              className="flex flex-col gap-2 py-3"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`nb-flat mt-0.5 grid size-7 shrink-0 place-items-center ${
                    item.done ? "tone-success" : "tone-surface"
                  }`}
                >
                  {item.done && <Icon name="check" className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="t-ui [overflow-wrap:anywhere]">
                    {item.done && <span className="sr-only">{item.doneLabel} : </span>}
                    {item.label}
                    {item.optionalLabel && (
                      <Pill tone="chip" className="ml-2 align-middle">
                        {item.optionalLabel}
                      </Pill>
                    )}
                  </p>
                  {!item.done && item.hint && <p className="t-small muted">{item.hint}</p>}
                </div>
              </div>
              {!item.done && item.actions && <div className="flex flex-wrap gap-2 pl-10">{item.actions}</div>}
            </li>
          ))}
        </ol>
        {footer}
      </div>
    </Card>
  );
}
