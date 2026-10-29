import Link from "next/link";
import { dur } from "@/engine/format";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import type { WeekSummary } from "@/server/weeks";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Layout";

const t = fr.onboarding;

/** Écran récapitulatif de fin d'onboarding (§5) : semaine, durée de session, articles. */
export function OnboardingRecap({ result }: { result: { start: string; summary: WeekSummary } }) {
  const r = t.recap;
  const tiles = [
    { value: String(result.summary.meals), label: r.meals, tone: "tone-violet" },
    { value: dur(result.summary.sessionMinutes), label: r.session, tone: "tone-blue" },
    { value: String(result.summary.shoppingItems), label: r.shopping, tone: "tone-pink" },
  ];
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <PageHeader title={r.title} />
        <p className="muted">{r.lead(formatShort(result.start))}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3" data-testid="onboarding-recap">
        {tiles.map((tile) => (
          <li key={tile.label} className={`card flex flex-col gap-1 ${tile.tone}`}>
            <span className="num-l">{tile.value}</span>
            <span className="t-label">{tile.label}</span>
          </li>
        ))}
      </ul>
      <Link href="/app" className={buttonClass({ size: "lg" })}>
        {r.cta}
      </Link>
    </div>
  );
}
