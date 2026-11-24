"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { RecipeImage } from "@/components/ui/RecipeImage";
import { fr } from "@/i18n/fr";
import type { MealView, MenuView } from "@/server/menu-view";
import { Flag } from "./Flag";

const t = fr.menuScreen;

/**
 * Repas d'une carte-jour, en lecture : toucher la carte ouvre la recette (ingrédients, matériel, étapes).
 * `detailed` : carte du jour sélectionné, qui porte la consigne du jour. Les modifications se font dans « Organiser ».
 */
function MealBlock({
  meal: m,
  detailed,
  onOpen,
}: {
  meal: MealView;
  detailed: boolean;
  onOpen?: (recipeId: string) => void;
}) {
  const body = (
    <>
      {m.photo && (
        <RecipeImage
          photo={m.photo}
          sizes="(min-width: 900px) 280px, 80vw"
          decorative
          className={`-mx-3 -mt-3 mb-1 aspect-[16/10] border-b-[length:var(--bw)] border-line ${m.removed ? "opacity-40 grayscale" : ""}`}
        />
      )}
      <span className="t-label">{m.removed ? `${m.label.split(" · ")[0]} · ${t.removedLabel}` : m.label}</span>
      <span className={`t-3 ${m.removed ? "line-through" : ""}`}>
        <Flag flag={m.flag} />
        {m.name}
      </span>
      {detailed && !m.removed && m.how && <span className="t-small muted">{m.how}</span>}
      {/* Convives affichés seulement s'ils changent de l'habitude. */}
      {m.guestsCustom && (
        <span className="flex">
          <Pill className="mono max-w-full !whitespace-normal !leading-tight">{m.guests}</Pill>
        </span>
      )}
    </>
  );
  const cls = `flex flex-col gap-2 border-t-[length:var(--bw)] border-line p-3 text-left ${m.removed ? "tone-yellow border-dashed border-violet" : ""}`;
  return onOpen && !m.removed ? (
    <button
      type="button"
      data-testid={`meal-${m.key}`}
      aria-label={t.openRecipe(m.name)}
      onClick={() => onOpen(m.recipeId)}
      className={`${cls} w-full cursor-pointer hover:bg-chip`}
    >
      {body}
    </button>
  ) : (
    <div data-testid={`meal-${m.key}`} className={cls}>
      {body}
    </div>
  );
}

function DayCard({
  day,
  today,
  selected,
  cake,
  extra,
  onSelect,
  onOpen,
}: {
  day: MenuView["days"][number];
  today: boolean;
  selected: boolean;
  cake: MenuView["cake"];
  extra?: React.ReactNode;
  onSelect: () => void;
  onOpen: (recipeId: string) => void;
}) {
  const weekend = day.day > 5;
  const meals = day.meals;
  const label = `${fr.daysAbbr[day.day - 1]} ${Number(day.iso.slice(8))}${today ? ` · ${t.today}` : ""}`;
  return (
    <article
      className={`nb tone-surface flex w-full flex-col ${selected ? "outline-3 outline-offset-3 outline-violet" : ""}`}
    >
      <header className={`px-3 py-2.5 ${today ? "tone-banane" : weekend ? "tone-menu" : "tone-dark"}`}>
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
      </header>
      {meals.length === 0 && !(selected && cake) && (
        <p className="t-small muted border-t-[length:var(--bw)] border-line p-3">
          {weekend ? t.weekendEmpty : t.noMeal}
        </p>
      )}
      {meals.map((m) => (
        <MealBlock key={m.key} meal={m} detailed={selected} onOpen={onOpen} />
      ))}
      {selected && cake && (
        <div className="flex flex-col gap-1 border-t-[length:var(--bw)] border-line p-3">
          <span className="t-label">{t.cakeLabel}</span>
          <b className="t-3">{cake.name}</b>
          <p className="t-small muted">
            {cake.parts}. {cake.kid}
          </p>
        </div>
      )}
      {selected && (day.thaw.length > 0 || extra) && (
        <div className="mt-auto flex flex-col gap-3 border-t-[length:var(--bw)] border-line p-3">
          {day.thaw.length > 0 && (
            <p className="nb-sm tone-yellow t-small flex items-center gap-2 px-3 py-2" data-testid="thaw-reminder">
              <Icon name="snow" className="size-5 shrink-0" />
              <span>
                <b>{today ? t.thawTonight : t.thawEve}</b> {t.thaw(day.thaw)}
              </span>
            </p>
          )}
          {extra}
        </div>
      )}
    </article>
  );
}

/**
 * Semaine en carrousel de cartes-jours, en lecture (vue « Cette semaine ») : les sept jours défilent à l'horizontale.
 * Seule la carte du jour sélectionné (aujourd'hui par défaut) porte le programme : consigne, goûter, décongélation
 * et cantine. Toucher un repas ouvre sa recette.
 */
export function WeekBoard({
  view,
  selected,
  onSelect,
  extraFor,
  onOpen,
}: {
  view: MenuView;
  selected: number;
  onSelect: (day: number) => void;
  /** Blocs ajoutés en bas d'une carte-jour (menu de la cantine). */
  extraFor?: (day: MenuView["days"][number]) => React.ReactNode;
  onOpen: (recipeId: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const days = view.days;
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
  }, [selected, updateEdges]);

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
              cake={view.cake && view.cake.day === d.day ? view.cake : null}
              extra={extraFor?.(d)}
              onSelect={() => onSelect(d.day)}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
