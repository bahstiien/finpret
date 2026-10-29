import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/Layout";
import { PassportBlock } from "@/components/progress/PassportBlock";
import { PauseSheet } from "@/components/progress/PauseSheet";
import { ProgressViewed } from "@/components/progress/ProgressViewed";
import { WeekStrip } from "@/components/progress/WeekStrip";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { loadProgressView } from "@/server/progress-view";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: fr.progress.title };

const t = fr.progress;
const FROM = ["tile", "profile", "session"] as const;

/** « Nos progrès » (SPEC_PROGRES §3.5, §4.4) : série de semaines fin prêtes et passeport des saveurs. */
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { user, household } = await requireHousehold("/app/progress");
  const [view, params] = await Promise.all([loadProgressView(household.id, user.id), searchParams]);
  const from = FROM.find((f) => f === params.from) ?? "tile";
  const { streak } = view;
  const percent = streak.nextMilestone
    ? Math.min(100, Math.round((streak.current / streak.nextMilestone) * 100))
    : 100;
  const currentLabel = {
    todo: t.streak.currentTodo,
    done: t.streak.currentDone,
    paused: t.streak.currentPaused,
    neutral: t.streak.currentNeutral,
  }[streak.currentWeek];

  return (
    <>
      <ProgressViewed from={from} />
      <PageHeader title={t.title} />

      <Card className="flex flex-col gap-4" aria-labelledby="streak-title">
        <h2 id="streak-title" className="sr-only">
          {t.streak.label}
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-violet-soft text-violet-strong">
            <Icon name="streak" className="size-8" />
          </span>
          <div>
            <p
              className="font-display text-5xl leading-none font-bold min-[900px]:text-6xl"
              data-testid="streak-current"
            >
              {t.streak.weeks(streak.current)}
            </p>
            <p className="mt-1 text-muted" data-testid="streak-week">
              {currentLabel}
            </p>
          </div>
        </div>

        {streak.hasHistory ? (
          <>
            <WeekStrip weeks={streak.frise} />
            <div className="flex flex-col gap-2">
              <p className="font-semibold">{t.streak.best(streak.best)}</p>
              {streak.nextMilestone && (
                <>
                  <p className="text-muted">{t.streak.next(streak.nextMilestone)}</p>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={streak.nextMilestone}
                    aria-valuenow={streak.current}
                    aria-label={t.streak.next(streak.nextMilestone)}
                    className="h-3 overflow-hidden rounded-r2 bg-chip"
                  >
                    <div className="h-full rounded-r2 bg-violet" style={{ width: `${percent}%` }} />
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted">{t.empty}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <PauseSheet options={streak.pauseOptions} canEdit={household.role !== "viewer"} />
          <p className="text-sm text-muted" data-testid="pauses-left">
            {t.streak.pausesLeft(streak.pausesLeftThisQuarter)}
          </p>
        </div>
      </Card>

      <PassportBlock countries={view.countries} seasons={view.seasons} />
    </>
  );
}
