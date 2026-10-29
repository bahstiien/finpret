"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { toggleMealAction } from "@/server/actions/menu";
import type { MealView, MenuView } from "@/server/menu-view";
import { Flag } from "./Flag";
import { useMenuAction } from "./useMenuAction";
import { Card } from "@/components/ui/Card";

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
    <Card padding="cozy" className="flex flex-col gap-3" aria-labelledby="day-program">
      <h2 id="day-program" className="flex items-center gap-2 text-xl font-bold">
        <Icon name="clock" />
        {isToday ? t.programToday : t.programOf(fr.days[day.day - 1]!)}
      </h2>
      {day.meals.length === 0 && !cake ? (
        <p className="text-muted">{day.day > 5 ? t.weekendEmpty : t.noMeal}</p>
      ) : (
        <ol className="relative flex flex-col gap-4 pl-8">
          <span aria-hidden="true" className="absolute top-3 bottom-3 left-[11px] w-0.5 bg-line" />
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
                className="absolute top-1 -left-8 size-6 rounded-full border-2 border-line bg-surface"
              />
              <p className="text-sm text-muted">{t.cakeLabel}</p>
              <b className="text-lg">{cake.name}</b>
              <p className="text-sm text-muted">
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
    m.favorite && { label: t.badges.favorite, tone: "bg-yellow-soft" },
    m.kind === "simple" && { label: t.badges.simple, tone: "bg-violet-soft text-violet-strong" },
    m.kind === "bank" && { label: t.badges.freezer, tone: "bg-blue-soft text-blue-ink" },
  ].filter(Boolean) as { label: string; tone: string }[];
  return (
    <li className={`relative ${m.removed ? "opacity-50" : ""}`} data-testid={`meal-${m.key}`}>
      <span
        aria-hidden="true"
        className={`absolute top-1 -left-8 size-6 rounded-full border-2 ${m.removed ? "border-line bg-surface" : "border-violet bg-surface"}`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-muted">
            {m.removed ? `${m.label.split(" · ")[0]} · ${t.removedLabel}` : m.label}
          </span>
          <b className={`text-lg leading-tight ${m.removed ? "line-through" : ""}`}>
            <Flag flag={m.flag} />
            {m.name}
          </b>
          {!m.removed && <p className="text-sm text-muted">{m.how}</p>}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onGuests(m)}
              className={`inline-flex min-h-8 items-center gap-1 rounded-r2 px-3 text-sm font-semibold ${m.guestsCustom ? "bg-blue-soft text-blue-ink" : "bg-chip"}`}
            >
              <Icon name="users" className="size-4" />
              {m.guests}
            </button>
            {badges.map((b) => (
              <span
                key={b.label}
                className={`inline-flex min-h-8 items-center rounded-r2 px-3 text-sm font-semibold ${b.tone}`}
              >
                {b.label}
              </span>
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
              className="grid size-11 place-items-center rounded-full bg-chip"
            >
              <Icon name="more" />
            </button>
            {open && (
              <ul
                role="menu"
                className="absolute top-12 right-0 z-30 flex w-52 flex-col rounded-card bg-surface p-2 shadow-hard border-[length:var(--bw)] border-line"
              >
                {!m.removed && (
                  <li role="none">
                    <button
                      role="menuitem"
                      type="button"
                      className="min-h-11 w-full rounded-card px-3 text-left font-semibold hover:bg-chip border-[length:var(--bw)] border-line"
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
                    className="min-h-11 w-full rounded-card px-3 text-left font-semibold hover:bg-chip border-[length:var(--bw)] border-line"
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
                    className="min-h-11 w-full rounded-card px-3 text-left font-semibold hover:bg-chip border-[length:var(--bw)] border-line"
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
