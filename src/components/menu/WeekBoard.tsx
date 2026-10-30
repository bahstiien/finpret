"use client";

import { Difficulty } from "@/components/ui/Extras";
import { Pill } from "@/components/ui/Pill";
import { fr } from "@/i18n/fr";
import type { MenuView } from "@/server/menu-view";
import { Flag } from "./Flag";

const t = fr.menuScreen;

export type BoardFilter = "week" | "lunch" | "dinner" | "weekend";

function DayCard({
  day,
  today,
  selected,
  filter,
  onSelect,
}: {
  day: MenuView["days"][number];
  today: boolean;
  selected: boolean;
  filter: BoardFilter;
  onSelect: () => void;
}) {
  const weekend = day.day > 5;
  const meals = day.meals.filter((m) => filter === "week" || filter === "weekend" || m.meal === filter);
  const label = `${fr.daysAbbr[day.day - 1]} ${Number(day.iso.slice(8))}${today ? ` · ${fr.menuScreen.today}` : ""}`;
  return (
    <article
      className={`nb tone-surface flex flex-col ${selected ? "outline-3 outline-offset-3 outline-violet" : ""}`}
    >
      <header
        className={`flex items-center justify-between px-3 py-2.5 ${today ? "tone-banane" : weekend ? "tone-menu" : "tone-dark"}`}
      >
        <h3 className="t-kicker">
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            aria-label={`${fr.days[day.day - 1]} ${Number(day.iso.slice(8))}${today ? `, ${t.today}` : ""}`}
            className="cursor-pointer uppercase underline-offset-4 hover:underline"
          >
            {label}
          </button>
        </h3>
        <span className="t-kicker">
          {weekend && meals.length === 0 ? t.board.onSite : t.board.meals(meals.length)}
        </span>
      </header>
      {meals.length === 0 && (
        <p className="t-small muted border-t-[length:var(--bw)] border-line p-3">{t.noMeal}</p>
      )}
      {meals.map((m) => (
        <div
          key={m.key}
          className={`flex flex-col gap-2 border-t-[length:var(--bw)] border-line p-3 ${m.removed ? "tone-yellow border-dashed border-violet" : ""}`}
        >
          <span className="t-label">{fr.meals[m.meal]}</span>
          <p className={`t-3 ${m.removed ? "line-through" : ""}`}>
            <Flag flag={m.flag} />
            {m.name}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {m.favorite && <Pill tone="banane">{fr.menuScreen.badges.favorite}</Pill>}
            {m.kind === "simple" && <Pill>{fr.menuScreen.badges.simple}</Pill>}
            {m.removed && <Pill tone="pink">{t.board.removed}</Pill>}
            <Pill className="mono">{m.guests}</Pill>
            {m.difficulty >= 1 && m.difficulty <= 4 && (
              <Pill className="mono">
                {m.difficulty}/4 <Difficulty level={m.difficulty as 1 | 2 | 3 | 4} />
              </Pill>
            )}
          </div>
        </div>
      ))}
    </article>
  );
}

/** Semaine en cartes-jours (maquette) : 5 jours en grille, week-end dessous, filtre Semaine / Midis / Soirs / Week-end. */
export function WeekBoard({
  view,
  filter,
  selected,
  onSelect,
}: {
  view: MenuView;
  filter: BoardFilter;
  selected: number;
  onSelect: (day: number) => void;
}) {
  const week = view.days.filter((d) => d.day <= 5);
  const weekend = view.days.filter((d) => d.day > 5);
  const card = (d: MenuView["days"][number]) => (
    <DayCard
      key={d.day}
      day={d}
      today={d.day === view.todayIndex}
      selected={selected === d.day}
      filter={filter}
      onSelect={() => onSelect(d.day)}
    />
  );
  return (
    <div className="flex flex-col gap-6" data-testid="week-board">
      {filter !== "weekend" && (
        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-5 min-[900px]:gap-6">
          {week.map(card)}
        </div>
      )}
      {(filter === "week" || filter === "weekend") && (
        <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-3 min-[900px]:gap-6">
          {weekend.map(card)}
        </div>
      )}
    </div>
  );
}
