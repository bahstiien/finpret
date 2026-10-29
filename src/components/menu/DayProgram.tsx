"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { toggleMealAction } from "@/server/actions/menu";
import type { MealView, MenuView } from "@/server/menu-view";
import { Flag } from "./Flag";
import { useMenuAction } from "./useMenuAction";
import { Card } from "@/components/ui/Card";
import { Pill, type PillTone } from "@/components/ui/Pill";

const t = fr.menuScreen;

/** Programme du jour en frise (§8.1) : midi et soir, consignes, convives, badges et actions •••. */
export function DayProgram({
  day,
  isToday,
  canEdit,
  cake,
  weekId,
  onMove,
  onGuests,
}: {
  day: MenuView["days"][number];
  isToday: boolean;
  canEdit: boolean;
  cake: MenuView["cake"];
  weekId: string;
  onMove: (from: string) => void;
  onGuests: (m: MealView) => void;
}) {
  return (
    <Card padding="cozy" className="flex flex-col gap-4" aria-labelledby="day-program">
      <h2 id="day-program" className="t-2 flex items-center gap-2">
        <Icon name="clock" />
        {isToday ? t.programToday : t.programOf(fr.days[day.day - 1]!)}
      </h2>
      {day.meals.length === 0 && !cake ? (
        <p className="t-small muted">{day.day > 5 ? t.weekendEmpty : t.noMeal}</p>
      ) : (
        <ol className="relative flex flex-col gap-4 pl-8">
          <span aria-hidden="true" className="absolute top-3 bottom-3 left-[11px] w-[var(--bw)] bg-line" />
          {day.meals.map((m) => (
            <MealRow
              key={m.key}
              meal={m}
              canEdit={canEdit}
              weekId={weekId}
              onMove={onMove}
              onGuests={onGuests}
            />
          ))}
          {cake && (
            <li className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1 -left-8 size-6 border-[length:var(--bw)] border-line bg-banane"
              />
              <p className="t-label">{t.cakeLabel}</p>
              <b className="t-3">{cake.name}</b>
              <p className="t-small muted">
                {cake.parts}. {cake.kid}
              </p>
            </li>
          )}
        </ol>
      )}
    </Card>
  );
}

function MealRow({
  meal: m,
  canEdit,
  weekId,
  onMove,
  onGuests,
}: {
  meal: MealView;
  canEdit: boolean;
  weekId: string;
  onMove: (from: string) => void;
  onGuests: (m: MealView) => void;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useMenuAction();
  const badges = [
    m.favorite && { label: t.badges.favorite, tone: "banane" },
    m.kind === "simple" && { label: t.badges.simple, tone: "chip" },
    m.kind === "bank" && { label: t.badges.freezer, tone: "blue" },
  ].filter(Boolean) as { label: string; tone: PillTone }[];
  return (
    <li className="relative" data-testid={`meal-${m.key}`}>
      <span
        aria-hidden="true"
        className={`absolute top-1 -left-8 size-6 border-[length:var(--bw)] border-line ${m.removed ? "border-dashed bg-chip" : "bg-violet"}`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="t-label">
            {m.removed ? `${m.label.split(" · ")[0]} · ${t.removedLabel}` : m.label}
          </span>
          <b className={`t-3 ${m.removed ? "line-through" : ""}`}>
            <Flag flag={m.flag} />
            {m.name}
          </b>
          {!m.removed && <p className="t-small muted">{m.how}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onGuests(m)}
              className={`chiptg mono ${m.guestsCustom ? "tone-blue" : "tone-chip"}`}
            >
              <Icon name="users" />
              {m.guests}
            </button>
            {badges.map((b) => (
              <Pill key={b.label} tone={b.tone}>
                {b.label}
              </Pill>
            ))}
          </div>
        </div>
        {canEdit && m.kind !== "weekend" && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={t.actionsFor(m.name)}
              onClick={() => setOpen(!open)}
              className="iconbtn"
            >
              <Icon name="more" />
            </button>
            {open && (
              <ul
                role="menu"
                className="nb absolute top-12 right-0 z-30 flex w-52 flex-col gap-1 bg-surface p-2"
              >
                {!m.removed && (
                  <li role="none">
                    <button
                      role="menuitem"
                      type="button"
                      className="t-ui min-h-11 w-full border-[length:var(--bw)] border-transparent px-3 text-left hover:border-line hover:bg-chip"
                      onClick={() => {
                        setOpen(false);
                        onMove(m.key);
                      }}
                    >
                      {t.menu.move}
                    </button>
                  </li>
                )}
                <li role="none">
                  <button
                    role="menuitem"
                    type="button"
                    className="t-ui min-h-11 w-full border-[length:var(--bw)] border-transparent px-3 text-left hover:border-line hover:bg-chip"
                    onClick={() => {
                      setOpen(false);
                      onGuests(m);
                    }}
                  >
                    {t.menu.guests}
                  </button>
                </li>
                <li role="none">
                  <button
                    role="menuitem"
                    type="button"
                    disabled={pending}
                    className="t-ui min-h-11 w-full border-[length:var(--bw)] border-transparent px-3 text-left hover:border-line hover:bg-chip"
                    onClick={() => {
                      setOpen(false);
                      run(() => toggleMealAction(weekId, m.day, m.meal));
                    }}
                  >
                    {m.removed ? t.menu.restore : t.menu.remove}
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
