"use client";

import { type ReactNode, useEffect, useId } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * Bulle de conseil fermable (SPEC_PRISE_EN_MAIN §4.2) : la `.coach` du design system Néo (voir `Coachmark` dans
 * Extras, version statique), avec « Compris », une croix et Échap. Non modale, elle ne prend pas le focus.
 * À placer dans le DOM juste après son ancre (ordre de tabulation naturel) ; l'ancre peut la référencer par `id`.
 * Apparition en fondu de 220 ms, arrêtée par `prefers-reduced-motion`.
 */
export function TipCoachmark({
  id,
  children,
  okLabel,
  closeLabel,
  regionLabel,
  onDismiss,
}: {
  id?: string;
  children: ReactNode;
  okLabel: string;
  closeLabel: string;
  regionLabel: string;
  onDismiss: () => void;
}) {
  const auto = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  return (
    <div className="pt-3" data-testid="coachmark">
      <section role="region" aria-label={regionLabel} id={id ?? auto} className="coach page-enter !max-w-md">
        <span
          className="coach-arrow"
          aria-hidden="true"
          style={{ top: -11, left: 24, transform: "rotate(225deg)" }}
        />
        <div className="flex items-start gap-3">
          <p className="t-small flex-1 font-bold">{children}</p>
          <button type="button" onClick={onDismiss} aria-label={closeLabel} className="iconbtn shrink-0">
            <Icon name="close" />
          </button>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={onDismiss} className="self-start">
          {okLabel}
        </Button>
      </section>
    </div>
  );
}
