import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/Layout";
import { AntigaspiCard } from "@/components/progress/AntigaspiCard";
import { OriginsList, type OriginItem } from "@/components/progress/OriginsList";
import { PassportBlock } from "@/components/progress/PassportBlock";
import { PauseTokensCard } from "@/components/progress/PauseTokensCard";
import { ProgressStats } from "@/components/progress/ProgressStats";
import { ProgressViewed } from "@/components/progress/ProgressViewed";
import { StreakCard } from "@/components/progress/StreakCard";
import { WorldMap } from "@/components/progress/WorldMap";
import { seasonEnd } from "@/engine/progress-view";
import { fr } from "@/i18n/fr";
import { addDays } from "@/lib/dates";
import { loadAntigaspiImpact } from "@/server/antigaspi";
import { loadHouseholdContext } from "@/server/household-context";
import { flagOf, type Flag } from "@/server/menu-view";
import { loadProgressStats, loadProgressView } from "@/server/progress-view";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: fr.progress.title };

const t = fr.progress;
const FROM = ["tile", "profile", "session"] as const;

/**
 * « Nos progrès » (SPEC_PROGRES §3.5, §4.4 ; maquette Claude Design « Nos progrès ») : la série et ses jetons en tête,
 * puis les chiffres, le passeport des saveurs et les origines. Deux colonnes dès 900 px.
 */
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { user, household } = await requireHousehold("/app/progress");
  const [view, params, stats, ctx] = await Promise.all([
    loadProgressView(household.id, user.id),
    searchParams,
    loadProgressStats(household.id),
    loadHouseholdContext(household.id),
  ]);
  const antigaspi = await loadAntigaspiImpact(household.id, ctx.timezone);
  const from = FROM.find((f) => f === params.from) ?? "tile";

  const earned = view.countries.filter((c) => c.earned);
  const latest = earned.reduce((m, c) => ((c.firstCookedOn ?? "") > m ? (c.firstCookedOn ?? "") : m), "");
  const origins: OriginItem[] = [...earned]
    .sort((a, b) => (b.firstCookedOn ?? "").localeCompare(a.firstCookedOn ?? ""))
    .map((c) => ({
      code: c.code,
      label: c.label,
      flag: flagOf(c.code),
      since: c.firstCookedOn ?? view.today,
      recipes: c.cooked.length,
      isNew: !!latest && c.firstCookedOn === latest,
    }));
  const flags: Record<string, Flag> = Object.fromEntries(view.countries.map((c) => [c.code, flagOf(c.code)]));
  const end = seasonEnd(view.seasonCards.current.key);
  const seasonsEarned = view.seasons.filter((s) => s.earned).length;

  return (
    <>
      <ProgressViewed from={from} />
      <PageHeader title={t.title} />

      <div className="@container flex flex-col gap-10 min-[900px]:gap-12">
        <div className="grid items-start gap-5 @min-[780px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] @min-[780px]:gap-8">
          <StreakCard view={view} />
          <div className="flex min-w-0 flex-col gap-10">
            <PauseTokensCard view={view} canEdit={household.role !== "viewer"} />
            <ProgressStats sessions={stats.sessions} meals={stats.meals} origins={earned.length} />
          </div>
        </div>

        <div className="grid items-start gap-10 @min-[780px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] @min-[780px]:gap-8">
          <section aria-labelledby="passport-title" className="flex min-w-0 flex-col gap-4">
            <h2 id="passport-title" className="t-2">
              {t.passport.title}
            </h2>
            <PassportBlock
              countries={view.countries}
              seasons={view.seasonCards}
              seasonEnd={end}
              nextSeasonStart={addDays(end, 1)}
              seasonsEarned={seasonsEarned}
              flags={flags}
              map={<WorldMap countries={view.countries} />}
            />
          </section>
          <div className="flex min-w-0 flex-col gap-10">
            <section aria-labelledby="origins-title" className="flex min-w-0 flex-col gap-4">
              <h2 id="origins-title" className="t-2">
                {t.passport.originsCooked}
              </h2>
              <OriginsList origins={origins} />
            </section>
            <AntigaspiCard month={antigaspi.month} total={antigaspi.total} />
          </div>
        </div>
      </div>
    </>
  );
}
