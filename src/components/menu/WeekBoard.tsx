"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Difficulty } from "@/components/ui/Extras";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { RecipeImage } from "@/components/ui/RecipeImage";
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
      className={`nb tone-surface flex w-full flex-col ${selected ? "outline-3 outline-offset-3 outline-violet" : ""}`}
    >
      <header
        className={`flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 px-3 py-2.5 ${today ? "tone-banane" : weekend ? "tone-menu" : "tone-dark"}`}
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
        <span className="t-kicker whitespace-nowrap">
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
          {m.photo && (
            <RecipeImage
              photo={m.photo}
              sizes="(min-width: 900px) 240px, 100vw"
              decorative
              className={`-mx-3 -mt-3 mb-1 aspect-[16/10] border-b-[length:var(--bw)] border-line ${m.removed ? "opacity-40 grayscale" : ""}`}
            />
          )}
          <span className="t-label">{fr.meals[m.meal]}</span>
          <p className={`t-3 ${m.removed ? "line-through" : ""}`}>
            <Flag flag={m.flag} />
            {m.name}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {m.favorite && <Pill tone="banane">{fr.menuScreen.badges.favorite}</Pill>}
            {m.kind === "simple" && <Pill>{fr.menuScreen.badges.simple}</Pill>}
            {m.removed && <Pill tone="pink">{t.board.removed}</Pill>}
            {/* Le libellé des convives peut être long (« 3 adultes et 1 enfant ») : il passe à la ligne dans la colonne. */}
            <Pill className="mono max-w-full !whitespace-normal !leading-tight">{m.guests}</Pill>
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

/**
 * Semaine en carrousel de cartes-jours : les sept jours défilent à l'horizontale (week-end compris), filtre
 * Semaine / Midis / Soirs / Week-end. Le jour sélectionné (aujourd'hui par défaut) est amené au début.
 */
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
  const track = useRef<HTMLDivElement>(null);
  const days = filter === "weekend" ? view.days.filter((d) => d.day > 5) : view.days;
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  // Amène le jour sélectionné au début de la bande s'il n'est pas entièrement visible, sans faire défiler la page.
  useEffect(() => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>(`[data-day="${selected}"]`);
    if (el && card) {
      const hidden = card.offsetLeft < el.scrollLeft || card.offsetLeft + card.offsetWidth > el.scrollLeft + el.clientWidth;
      if (hidden) el.scrollTo({ left: card.offsetLeft - 4, behavior: "smooth" });
    }
    updateEdges();
  }, [selected, filter, updateEdges]);

  // Une page à la fois : autant de jours qu'il en tient à l'écran (le magnétisme cale la bande sur une carte).
  const step = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>("[data-day]");
    if (!el || !card) return;
    const perPage = Math.max(1, Math.floor(el.clientWidth / (card.offsetWidth + 16)));
    el.scrollBy({ left: dir * perPage * (card.offsetWidth + 16), behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="week-board">
      <div className="hidden justify-end gap-2 min-[700px]:flex">
        <button
          type="button"
          className="iconbtn"
          aria-label={t.board.prev}
          disabled={edges.start}
          onClick={() => step(-1)}
        >
          <Icon name="arrowBack" />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label={t.board.next}
          disabled={edges.end}
          onClick={() => step(1)}
        >
          <Icon name="arrowRight" />
        </button>
      </div>
      <div
        ref={track}
        onScroll={updateEdges}
        className="relative -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pt-1 pb-4"
      >
        {days.map((d) => (
          <div key={d.day} data-day={d.day} className="flex w-[min(78vw,280px)] shrink-0 snap-start">
            <DayCard
              day={d}
              today={d.day === view.todayIndex}
              selected={selected === d.day}
              filter={filter}
              onSelect={() => onSelect(d.day)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
