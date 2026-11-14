"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import type { SessionLevel } from "@/engine/types";
import { fr } from "@/i18n/fr";
import {
  dismissPrepTileAction,
  prepSheetOpenedAction,
  setFirstSessionLevelAction,
} from "@/server/actions/getting-started";

const t = fr.gettingStarted.tile;
const p = fr.gettingStarted.prepSheet;

export type PrepData = {
  state: "eve" | "today";
  /** Jour local du foyer (clé de la fermeture « Plus tard »). */
  today: string;
  boxes: { portions: string; label: string; box: string | null }[];
  fridge: number;
  freezer: number;
  shopping: { checked: number; total: number };
  /** Durée formatée (« 3 h 30 ») et heure de fin prévue (« 17:30 »). */
  duration: string;
  end: string;
  level: SessionLevel;
  isAdmin: boolean;
  /** Tile déjà fermée aujourd'hui : la Sheet reste ouvrable par le lien `?prep=1`. */
  tileDismissed: boolean;
  initialOpen: boolean;
};

/** Tile « Demain, ta première session » et Sheet de préparation (SPEC_PRISE_EN_MAIN §4.4.1, §4.4.2). */
export function PrepTile({ data }: { data: PrepData }) {
  const [open, setOpen] = useState(data.initialOpen);
  const [hidden, setHidden] = useState(data.tileDismissed);
  const [, start] = useTransition();
  const title = data.state === "eve" ? t.titleEve : t.titleToday;

  const show = () => {
    setOpen(true);
    void prepSheetOpenedAction();
  };

  const allChecked = data.shopping.total > 0 && data.shopping.checked >= data.shopping.total;
  return (
    <>
      {!hidden && (
        <Tile
          icon="timer"
          title={title}
          subtitle={t.subtitle}
          actionLabel={t.cta}
          onAction={show}
          dismissLabel={t.later}
          onDismiss={() => {
            setHidden(true);
            start(() => dismissPrepTileAction(data.today));
          }}
          testId="prep-tile"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={data.state === "eve" ? p.title : p.titleToday}>
        <div className="flex flex-col gap-5" data-testid="prep-sheet">
          <section aria-labelledby="prep-boxes" className="flex flex-col gap-2">
            <h3 id="prep-boxes" className="t-ui">
              {p.boxesTitle}
            </h3>
            <p data-testid="prep-boxes-count">{p.boxes(data.boxes.length, data.fridge, data.freezer)}</p>
            <ul className="flex flex-col gap-1 t-small muted">
              {data.boxes.map((b, i) => (
                <li key={i}>{p.boxLine(b.portions, b.label, b.box)}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="prep-room" className="flex flex-col gap-2">
            <h3 id="prep-room" className="t-ui">
              {p.roomTitle}
            </h3>
            <p>{p.room(data.fridge, data.freezer)}</p>
          </section>
          <section aria-labelledby="prep-shopping" className="flex flex-col gap-2">
            <h3 id="prep-shopping" className="t-ui">
              {p.shoppingTitle}
            </h3>
            <p>{allChecked ? p.shoppingDone : p.shopping(data.shopping.checked, data.shopping.total)}</p>
            {!allChecked && (
              <LinkButton href="/app/shopping" variant="outline" size="sm" className="self-start">
                {p.shoppingCta}
              </LinkButton>
            )}
          </section>
          <section aria-labelledby="prep-duration" className="flex flex-col gap-2">
            <h3 id="prep-duration" className="t-ui">
              {p.durationTitle}
            </h3>
            <p data-testid="prep-duration">{p.duration(data.duration, data.end)}</p>
          </section>
          <section aria-labelledby="prep-level" className="flex flex-col gap-2">
            <h3 id="prep-level" className="t-ui">
              {p.levelTitle}
            </h3>
            <Segmented<SessionLevel>
              label={p.levelLabel}
              value={data.level}
              options={[
                { value: "beginner", label: p.beginner },
                { value: "confident", label: p.confident },
              ]}
              onChange={(v) => start(() => setFirstSessionLevelAction(v))}
            />
            <p className="t-small muted">{p.levelHint}</p>
          </section>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setOpen(false)}>
              {p.ok}
            </Button>
            <LinkButton href="/app/session" variant="outline">
              {p.session}
            </LinkButton>
          </div>
          {data.isAdmin ? (
            <Link href="/settings/session" className="lnk min-h-11 content-center t-small">
              {p.move}
            </Link>
          ) : (
            <p className="t-small muted">{p.moveAsk}</p>
          )}
        </div>
      </Sheet>
    </>
  );
}
