"use client";

import { Button } from "./Button";
import { Card, type CardTone } from "./Card";
import { Icon, type IconName } from "./Icon";

/**
 * Carte d'action : une icône, un titre, une phrase, un bouton principal et une fermeture discrète.
 * Assemblage de `Card`, `Button` et `Icon` : aucun jeton nouveau (SPEC_PRISE_EN_MAIN §2, principe 6).
 */
export function Tile({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
  tone = "yellow",
  testId = "tile",
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  actionLabel: string;
  onAction: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
  tone?: CardTone;
  testId?: string;
}) {
  return (
    <Card as="section" tone={tone} padding="cozy" aria-label={title} data-testid={testId} className="page-enter flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="nb-sm tone-surface grid size-12 shrink-0 place-items-center"
        >
          <Icon name={icon} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="t-3 [overflow-wrap:anywhere]">{title}</h2>
          {subtitle && <p className="t-small">{subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onAction}>
          {actionLabel}
        </Button>
        {onDismiss && dismissLabel && (
          <Button type="button" variant="ghost" onClick={onDismiss} className="!text-inherit">
            {dismissLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
