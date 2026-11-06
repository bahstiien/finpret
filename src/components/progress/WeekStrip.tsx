import { Icon } from "@/components/ui/Icon";
import type { FriseState, FriseWeek } from "@/engine/progress-view";
import { fr } from "@/i18n/fr";
import { formatAbbr } from "@/lib/dates";

const t = fr.progress.streak;

/**
 * Une case de frise (planche d'états « Nos progrès ») : chaque état se lit sans la couleur.
 * Fin prête = case pleine et coche ; en pause = case blanche et pause ; sans session = case vide en pointillé ;
 * rien à préparer = trait sans case ; à venir = case blanche surélevée et horloge. Jamais de rouge.
 */
export function WeekCell({
  state,
  raised = false,
  className = "h-11 min-[900px]:h-16",
}: {
  state: FriseState;
  raised?: boolean;
  className?: string;
}) {
  const base = "box-border flex w-full items-center justify-center";
  const lift = raised || state === "todo" ? "-translate-y-[3px] shadow-[var(--sh-sm)]" : "";
  const look: Record<FriseState, string> = {
    done: "border-[length:var(--bw)] border-[var(--ink-fixed)] bg-[var(--ink-fixed)] text-[var(--banane)]",
    paused: "border-[length:var(--bw)] border-line bg-surface text-ink",
    missed: "border-[length:var(--bw)] border-dashed border-line",
    neutral: "text-ink",
    todo: "border-[length:var(--bw)] border-line bg-surface text-ink",
    none: "border-[length:var(--bw)] border-dashed border-line opacity-40",
  };
  return (
    <span aria-hidden="true" data-cell={state} className={`${base} ${look[state]} ${lift} ${className}`}>
      {state === "done" && <Icon name="check" className="size-4 min-[900px]:size-5" />}
      {state === "paused" && <Icon name="pause" className="size-4 min-[900px]:size-5" />}
      {state === "todo" && <Icon name="clock" className="size-4 min-[900px]:size-5" />}
      {state === "neutral" && <span className="block h-[3px] w-3/5 bg-current" />}
    </span>
  );
}

const LEGEND: Exclude<FriseState, "none">[] = ["done", "paused", "missed", "neutral", "todo"];

/** Frise des 12 dernières semaines (SPEC_PROGRES §3.5), la plus ancienne à gauche, la semaine en cours surélevée. */
export function WeekStrip({ weeks }: { weeks: FriseWeek[] }) {
  const first = weeks[0];
  return (
    <div className="flex flex-col gap-3">
      <ol
        aria-label={t.friseList}
        data-testid="week-strip"
        className="m-0 grid list-none grid-cols-12 items-end gap-1 p-0 pt-1 min-[900px]:gap-1.5"
      >
        {weeks.map((w) => {
          const state = w.state === "none" ? "" : t.weekState[w.state];
          return (
            <li
              key={w.weekStart}
              data-state={w.state}
              aria-current={w.current ? "date" : undefined}
              aria-label={t.friseCell(formatAbbr(w.weekStart), state, w.current)}
              className="min-w-0"
            >
              <WeekCell state={w.state} raised={w.current} />
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className="mono flex justify-between gap-3 text-xs font-bold">
        <span>{first ? formatAbbr(first.weekStart) : ""}</span>
        <span>{t.friseThisWeek}</span>
      </div>
      <ul aria-hidden="true" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
        {LEGEND.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="w-5 flex-none">
              <WeekCell state={s} className="h-[26px]" />
            </span>
            <span className="t-small">{t.legend[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
