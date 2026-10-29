import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/Layout";
import { PassportBlock } from "@/components/progress/PassportBlock";
import { PauseSheet } from "@/components/progress/PauseSheet";
import { ProgressViewed } from "@/components/progress/ProgressViewed";
import { WeekStrip } from "@/components/progress/WeekStrip";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { OriginsList } from "@/components/progress/OriginsList";
import { ProgressStats } from "@/components/progress/ProgressStats";
import { PAUSES_PER_QUARTER } from "@/engine/streak";
import { flagOf } from "@/server/menu-view";
import { loadProgressStats, loadProgressView } from "@/server/progress-view";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: fr.progress.title };

const t = fr.progress;
const FROM = ["tile", "profile", "session"] as const;

/** « Nos progrès » (SPEC_PROGRES §3.5, §4.4) : série de semaines fin prêtes et passeport des saveurs. */
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { user, household } = await requireHousehold("/app/progress");
  const [view, params, stats] = await Promise.all([
    loadProgressView(household.id, user.id),
    searchParams,
    loadProgressStats(household.id),
  ]);
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

  const [weeksNum, ...weeksRest] = t.streak.weeks(streak.current).split(" ");
  const pausesTotal = PAUSES_PER_QUARTER;
  const earnedCountries = view.countries.filter((c) => c.earned);
  const firstDates = earnedCountries.map((c) => c.firstCookedOn ?? "").sort();
  // Les origines obtenues lors de la dernière session (même date) sont mises en avant.
  const latest = firstDates[firstDates.length - 1] ?? "";
  const origins = [...earnedCountries]
    .sort((a, b) => (b.firstCookedOn ?? "").localeCompare(a.firstCookedOn ?? ""))
    .map((c) => ({ code: c.code, label: c.label, flag: flagOf(c.code), isNew: !!latest && c.firstCookedOn === latest }));
  return (
    <>
      <ProgressViewed from={from} />
      <PageHeader title={t.title} />

      <div className="grid gap-6 min-[900px]:grid-cols-2 min-[900px]:items-stretch">
        <Card tone="banane" className="flex flex-col gap-4" aria-labelledby="streak-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="streak-title" className="t-kicker">
              {t.streak.label}
            </h2>
            <Icon name="streak" className="size-8" />
          </div>
          <p className="flex items-end gap-3" data-testid="streak-current">
            <span className="mono text-[96px] leading-[.8] font-bold tracking-tighter min-[900px]:text-[150px]">
              {weeksNum}
            </span>{" "}
            <span className="t-2 pb-2">{weeksRest.join(" ")}</span>
          </p>
          <p className="t-ui" data-testid="streak-week">
            {currentLabel}
          </p>

          {streak.hasHistory ? (
            <>
              <WeekStrip weeks={streak.frise} />
              <div className="flex flex-col gap-2">
                <p className="t-ui">{t.streak.best(streak.best)}</p>
                {streak.nextMilestone && (
                  <>
                    <p className="t-small">{t.streak.next(streak.nextMilestone)}</p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={streak.nextMilestone}
                      aria-valuenow={streak.current}
                      aria-label={t.streak.next(streak.nextMilestone)}
                      className="bar"
                    >
                      <div className="bar-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="t-small">{t.empty}</p>
          )}
          {streak.hasHistory && <p className="t-small">{t.streak.resumeNote}</p>}
        </Card>

        <Card className="flex flex-col gap-4" aria-labelledby="pause-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="pause-title" className="t-2">
              {t.streak.pauseTokens}
            </h2>
            <span aria-hidden="true" className="mono text-xl font-bold">
              {streak.pausesLeftThisQuarter}/{pausesTotal}
            </span>
          </div>
          <div className="flex gap-3" aria-hidden="true">
            {Array.from({ length: pausesTotal }, (_, i) =>
              i < streak.pausesLeftThisQuarter ? (
                <span key={i} className="nb-sm tone-banane grid size-14 place-items-center">
                  <Icon name="pause" />
                </span>
              ) : (
                <span key={i} className="nb-dash grid size-14 place-items-center">
                  <Icon name="pause" className="size-5 text-muted" />
                </span>
              ),
            )}
          </div>
          <p className="t-small">{t.streak.pauseHelp}</p>
          <p className="t-small text-muted" data-testid="pauses-left">
            {t.streak.pausesLeft(streak.pausesLeftThisQuarter)}
          </p>
          <PauseSheet options={streak.pauseOptions} canEdit={household.role !== "viewer"} />
        </Card>
      </div>

      <ProgressStats sessions={stats.sessions} meals={stats.meals} origins={earnedCountries.length} />

      <PassportBlock countries={view.countries} seasons={view.seasons} />

      <OriginsList origins={origins} />
    </>
  );
}
