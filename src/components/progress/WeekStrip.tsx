import { Icon } from "@/components/ui/Icon";
import type { FriseWeek } from "@/engine/progress-view";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";

// Maquette Progrès : fin prête = encre, pause = banane, semaine en cours = sélection (violet), reste = surface.
const STYLE: Record<FriseWeek["state"], string> = {
  done: "tone-dark",
  paused: "tone-banane",
  neutral: "tone-chip",
  missed: "tone-surface",
  todo: "tone-sel",
  none: "tone-chip",
};

const LABEL: Record<FriseWeek["state"], string> = {
  done: fr.progress.streak.weekState.done,
  paused: fr.progress.streak.weekState.paused,
  neutral: fr.progress.streak.weekState.neutral,
  missed: fr.progress.streak.weekState.missed,
  todo: fr.progress.streak.weekState.todo,
  none: "",
};

/** Frise des 12 dernières semaines (SPEC_PROGRES §3.5) : jamais de rouge ni de pêche, même pour une semaine sans session. */
export function WeekStrip({ weeks }: { weeks: FriseWeek[] }) {
  return (
    <ol
      className="bento grid-cols-6 min-[600px]:grid-cols-12"
      aria-label={fr.progress.streak.frise}
      data-testid="week-strip"
    >
      {weeks.map((w) => (
        <li
          key={w.weekStart}
          data-state={w.state}
          aria-current={w.current ? "date" : undefined}
          aria-label={`${fr.progress.streak.pauseWeek(formatShort(w.weekStart))}${LABEL[w.state] ? `, ${LABEL[w.state]}` : ""}`}
          className={`flex min-h-10 items-center justify-center ${STYLE[w.state]}`}
        >
          {w.state === "paused" && <Icon name="pause" className="size-4" />}
          {w.state === "done" && <Icon name="check" className="size-4" />}
          {w.state === "missed" && (
            <span aria-hidden="true" className="mono font-bold">
              –
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
