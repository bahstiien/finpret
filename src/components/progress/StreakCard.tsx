import { Icon } from "@/components/ui/Icon";
import { nextMilestoneAfter } from "@/engine/streak";
import { fr } from "@/i18n/fr";
import { formatDayAbbr, formatMinutes } from "@/lib/dates";
import type { ProgressView } from "@/server/progress-view";
import { WeekCell, WeekStrip } from "./WeekStrip";

const t = fr.progress.streak;

const STATUS = {
  todo: t.currentTodo,
  done: t.currentDone,
  paused: t.currentPaused,
  neutral: t.currentNeutral,
} as const;

/** Statut de la semaine en cours : reprend le repère de la frise et pousse vers la session. */
function WeekStatus({ view }: { view: ProgressView }) {
  const { streak, week } = view;
  const s = streak.currentWeek;
  const meta =
    s === "todo"
      ? t.statusMeta.todo(
          formatDayAbbr(week.sessionOn),
          week.sessionMinutes ? formatMinutes(week.sessionMinutes) : null,
        )
      : s === "done"
        ? t.statusMeta.done
        : t.statusMeta[s](streak.current);
  return (
    <div className="flex items-center gap-3 border-[length:var(--bw)] border-line bg-surface p-3 text-ink">
      <span className="w-[26px] flex-none pt-[3px]">
        <WeekCell state={s} className="h-9" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t-ui" data-testid="streak-week">
          {STATUS[s]}
        </span>
        <span className="t-small">{meta}</span>
      </span>
    </div>
  );
}

/** Carte « Série » (maquette Nos progrès) : seule grande surface banane de l'écran. */
export function StreakCard({ view }: { view: ProgressView }) {
  const { streak } = view;
  const [l1, l2] = t.unit(streak.current);
  const next = streak.nextMilestone ?? nextMilestoneAfter(streak.current);
  const after = [nextMilestoneAfter(next), nextMilestoneAfter(nextMilestoneAfter(next))];
  const left = next - streak.current;
  return (
    <section
      className="card tone-banane flex min-w-0 flex-col gap-5 min-[900px]:gap-6"
      aria-labelledby="streak-title"
      data-testid="streak-card"
    >
      <h2 id="streak-title" className="t-kicker flex items-center gap-2">
        <Icon name="streak" className="size-5" />
        {t.label}
      </h2>

      <p className="flex flex-wrap items-end gap-x-4 gap-y-3" data-testid="streak-current">
        <span className="mono text-[96px] leading-[.78] font-bold tracking-[-.05em] min-[900px]:text-[150px]">
          {streak.current}
        </span>{" "}
        <span className="t-2 flex flex-col gap-0.5">
          <span>{l1}</span> <span>{l2}</span>
        </span>
      </p>

      {!streak.hasHistory && <p className="t-body">{t.welcome}</p>}

      <WeekStatus view={view} />

      {streak.hasHistory && (
        <>
          <WeekStrip weeks={streak.frise} />

          <div className="flex flex-col gap-3 border-t-[length:var(--bw)] border-line pt-5 min-[900px]:pt-6">
            <p className="t-ui flex items-center gap-2">
              <Icon name="trophy" className="size-5" />
              {t.bestShort(streak.best)}
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="t-small font-bold">{t.next(next)}</span>
                <span className="mono t-small font-bold">{t.milestoneValue(streak.current, next)}</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={next}
                aria-valuenow={streak.current}
                aria-label={t.next(next)}
                className="bar bar--lg"
              >
                <div className="bar-fill" style={{ width: `${Math.min(100, (streak.current / next) * 100)}%` }} />
              </div>
            </div>
            <p className="t-small">{t.remaining(left, after)}</p>
          </div>

          <p className="t-small flex items-start gap-2 border-t-[length:var(--bw)] border-line pt-5 min-[900px]:pt-6">
            <Icon name="info" className="size-4 flex-none" />
            <span>{t.resumeNote}</span>
          </p>
        </>
      )}
    </section>
  );
}
