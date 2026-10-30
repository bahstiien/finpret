import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { StreakState } from "@/engine/streak";
import { fr } from "@/i18n/fr";

const t = fr.menuScreen.seriesBanner;
const ts = fr.progress.streak;

/**
 * Bandeau « Série fin prête » de l'onglet Menu (SPEC_PROGRES §3.5) : visible dès 2 semaines fin prêtes, ou si la semaine
 * en cours est déjà fin prête. Mène à « Nos progrès ». Domaine Progrès = banane.
 */
export function SeriesBanner({ streak }: { streak: Pick<StreakState, "current" | "currentWeek"> }) {
  if (streak.current < 2 && streak.currentWeek !== "done") return null;
  const state = {
    todo: ts.currentTodo,
    done: ts.currentDone,
    paused: ts.currentPaused,
    neutral: ts.currentNeutral,
  }[streak.currentWeek];
  return (
    <Link
      href="/app/progress?from=tile"
      className="card tone-progres tilt-l flex min-h-16 flex-wrap items-center gap-4 !p-4"
      data-testid="streak-tile"
    >
      <span className="nb-flat tone-surface grid size-12 shrink-0 place-items-center">
        <Icon name="streak" className="size-6" />
      </span>
      <span className="flex flex-col">
        <span className="t-kicker">{t.kicker}</span>
        <span className="flex items-baseline gap-2">
          <span className="num-xl mono">{streak.current}</span>{" "}
          <span className="t-3">{t.weeks(streak.current)}</span>
        </span>
        <span className="t-small">{state}</span>
      </span>
    </Link>
  );
}
