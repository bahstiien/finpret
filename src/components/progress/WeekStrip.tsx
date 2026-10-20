import { Icon } from "@/components/ui/Icon";
import type { FriseWeek } from "@/engine/progress-view";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";

const STYLE: Record<FriseWeek["state"], string> = {
  done: "bg-violet text-white",
  paused: "bg-violet-soft text-violet-strong",
  neutral: "bg-yellow-soft text-cream-ink",
  missed: "border-2 border-line text-muted",
  todo: "border-2 border-dashed border-violet text-violet-strong",
  none: "bg-chip text-muted opacity-50",
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
      className="grid grid-cols-6 gap-2 min-[600px]:grid-cols-12"
      aria-label={fr.progress.streak.frise}
      data-testid="week-strip"
    >
      {weeks.map((w) => (
        <li
          key={w.weekStart}
          data-state={w.state}
          aria-current={w.current ? "date" : undefined}
          aria-label={`${fr.progress.streak.pauseWeek(formatShort(w.weekStart))}${LABEL[w.state] ? `, ${LABEL[w.state]}` : ""}`}
          className={`grid h-12 place-items-center rounded-2xl ${STYLE[w.state]}`}
        >
          {w.state === "paused" && <Icon name="pause" className="size-5" />}
          {w.state === "done" && <Icon name="check" className="size-5" />}
        </li>
      ))}
    </ol>
  );
}
