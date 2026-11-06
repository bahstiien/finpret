import Image from "next/image";
import { buttonClass } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Callout } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";
import { dur } from "@/engine/format";
import { fr } from "@/i18n/fr";
import type { RecipePhoto } from "@/seo/images";
import type { WeekSummary } from "@/server/weeks";
import Link from "next/link";

const t = fr.onboarding.flow.recap;

export type RecapDay = {
  /** « lundi 9 novembre » */
  label: string;
  meals: { meal: "lunch" | "dinner"; name: string; photo: RecipePhoto }[];
  /** Prénoms des enfants à la cantine ce midi-là. */
  canteen: string[];
};

/** Écran de fin d'onboarding (§5) : la semaine en photos, les chiffres clés, la cuisine standard à vérifier. */
export function OnboardingRecap({
  start,
  summary,
  session,
  days,
  trial,
}: {
  start: string;
  summary: WeekSummary;
  session: string;
  days: RecapDay[];
  trial: { association: string; until: string } | null;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-bg">
      <header className="flex min-h-11 items-center px-4 py-3">
        <Logo className="size-10 text-xl" />
      </header>
      <main className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-8">
        <div className="flex flex-col items-start gap-3">
          <Pill tone="chip" className="mono">
            {t.week(start)}
          </Pill>
          <h1 className="t-hero m-0">{t.title}</h1>
          <p className="t-body m-0">{t.lead(summary.meals)}</p>
        </div>

        {trial && (
          <Callout tone="success" icon="check" title={t.trial}>
            {t.trialLead(trial.until, trial.association)}
          </Callout>
        )}

        <ul className="nb m-0 grid list-none grid-cols-2 p-0" data-testid="onboarding-recap">
          <li className="tone-menu flex flex-col gap-1 border-r-[length:var(--bw)] border-b-[length:var(--bw)] border-line px-4 py-3">
            <span className="t-kicker">{t.meals}</span>
            <span className="num-l">{summary.meals}</span>
            <span className="t-small">{t.mealsHint}</span>
          </li>
          <li className="tone-courses flex flex-col gap-1 border-b-[length:var(--bw)] border-line px-4 py-3">
            <span className="t-kicker">{t.shopping}</span>
            <span className="num-l">{summary.shoppingItems}</span>
            <span className="t-small">{t.shoppingHint}</span>
          </li>
          <li className="tone-session col-span-2 flex items-center gap-4 px-4 py-3">
            <Icon name="timer" className="size-8" />
            <span className="flex flex-col gap-1">
              <span className="t-kicker">{t.session}</span>
              <span className="num-l">{dur(summary.sessionMinutes)}</span>
              <span className="t-small">{session}</span>
            </span>
          </li>
        </ul>

        {days.map((d) => (
          <section key={d.label} aria-label={d.label} className="flex flex-col gap-3">
            <h2 className="t-2 m-0 border-b-[length:var(--bw)] border-line pb-2 first-letter:uppercase">
              {d.label}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {d.meals.map((m) => (
                <div key={m.meal} className="flex min-w-0 flex-col gap-2">
                  <p className="t-kicker m-0 flex items-center gap-1">
                    <Icon name={m.meal === "lunch" ? "sun" : "moon"} className="size-4" />
                    {m.meal === "lunch" ? t.lunch : t.dinner}
                  </p>
                  <figure className="nb-sm m-0 flex flex-col overflow-hidden bg-surface">
                    <div className="relative aspect-[3/4] overflow-hidden" style={{ background: m.photo.bg }}>
                      <Image
                        src={m.photo.src}
                        alt={m.photo.alt}
                        fill
                        sizes="(max-width: 640px) 50vw, 280px"
                        className="object-cover"
                      />
                    </div>
                    <figcaption className="t-small border-t-[length:var(--bw)] border-line px-2 py-2 font-bold">
                      {m.name}
                    </figcaption>
                  </figure>
                  {m.meal === "lunch" && d.canteen.length > 0 && (
                    <p className="t-small m-0 flex items-start gap-1">
                      <Icon name="users" className="size-4" />
                      {t.canteen(d.canteen.join(" et "))}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="nb-sm flex flex-col gap-3 bg-surface p-4">
          <div className="flex items-center gap-3">
            <Icon name="chefHat" className="size-7" />
            <p className="t-ui m-0 flex-1">{t.kitchen}</p>
          </div>
          <p className="t-small muted m-0">{t.kitchenLead}</p>
          <div>
            <Link href="/settings/session" className={buttonClass({ variant: "outline", size: "sm" })}>
              <Icon name="sliders" className="size-5" />
              {t.kitchenCta}
            </Link>
          </div>
        </div>
      </main>
      <footer className="sticky bottom-0 flex flex-col gap-2 border-t-[length:var(--bw)] border-line bg-surface px-4 pt-3 pb-4">
        <Link href="/app" className={buttonClass({ size: "lg", className: "btn--block" })}>
          {t.cta}
          <Icon name="arrowRight" className="size-5" />
        </Link>
        <p className="t-small muted m-0 text-center">{t.email}</p>
      </footer>
    </div>
  );
}
