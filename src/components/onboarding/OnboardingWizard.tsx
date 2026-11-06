"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { IngredientOption } from "@/components/settings/IngredientPicker";
import { Button, IconButton } from "@/components/ui/Button";
import { Logo, MealFrieze } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Layout";
import { dur } from "@/engine/format";
import { previewKey } from "@/engine/onboarding";
import { fr } from "@/i18n/fr";
import { absencesFrom, type OnboardingInput, plannedMeals, skipFromAnswers } from "@/lib/onboarding";
import { completeOnboarding, retryFirstWeek } from "@/server/actions/onboarding";
import type { OnboardingDishes } from "@/server/onboarding-data";
import { DishPhoto } from "./DishPhoto";
import {
  EnviesStep,
  type HouseholdErrors,
  HouseholdStep,
  RestrictionsStep,
  type RhythmAnswers,
  RhythmStep,
  type SchoolOption,
  type Update,
  WelcomeStep,
} from "./OnboardingSteps";

export type { SchoolOption } from "./OnboardingSteps";

const t = fr.onboarding.flow;
const STEPS = ["household", "envies", "restrictions", "rhythm"] as const;
type Step = (typeof STEPS)[number];
type Screen = "welcome" | Step | "generating" | "failure";

const DEFAULT_ANSWERS: RhythmAnswers = {
  lunch: "oui",
  lunchDays: [1, 2, 3, 4, 5],
  dinner: "oui",
  dinnerDays: [1, 2, 3, 4, 5],
  away: [],
  moment: "dimanche",
  precise: false,
};

/** Champs manquants de l'étape Foyer (seule étape obligatoire), null si tout est rempli. */
function householdErrors(data: OnboardingInput): HouseholdErrors | null {
  const h = t.household;
  const members = data.household.members.map((m) => ({
    name: m.name.trim() ? undefined : h.nameMissing,
    birthdate: m.kind === "child" && !m.birthdate ? h.birthMissing : undefined,
  }));
  const name = data.household.name.trim() ? undefined : h.householdMissing;
  const missing = (name ? 1 : 0) + members.reduce((n, m) => n + (m.name ? 1 : 0) + (m.birthdate ? 1 : 0), 0);
  return missing ? { name, members } : null;
}

const countErrors = (e: HouseholdErrors) =>
  (e.name ? 1 : 0) + e.members.reduce((n, m) => n + (m.name ? 1 : 0) + (m.birthdate ? 1 : 0), 0);

/**
 * Onboarding (§5, refonte) : bienvenue, foyer (obligatoire), envies, restrictions, rythme, puis génération de la
 * première semaine. L'équipement garde la cuisine standard, ajustable depuis le récapitulatif.
 */
export function OnboardingWizard({
  initial,
  ingredients,
  schools = [],
  associationName = null,
  dishes,
  fromAccount,
}: {
  initial: OnboardingInput;
  ingredients: IngredientOption[];
  /** Écoles de l'association du code d'inscription (vide sans code valide). */
  schools?: SchoolOption[];
  associationName?: string | null;
  dishes: OnboardingDishes;
  /** Le prénom du premier adulte vient du compte. */
  fromAccount: boolean;
}) {
  const [data, setData] = useState(initial);
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [tried, setTried] = useState(false);
  const [nameTouched, setNameTouched] = useState(!!initial.household.name);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // Le nom du foyer suit le prénom du premier adulte (« Chez Camille ») tant qu'on ne l'a pas modifié.
  const update: Update = (fn) =>
    setData((d) => {
      const next = structuredClone(d);
      fn(next);
      if (!nameTouched)
        next.household.name = t.household.defaultName(next.household.members[0]?.name.trim() ?? "");
      return next;
    });
  useEffect(() => {
    if (!nameTouched) update(() => {});
    // Une seule fois, pour proposer le nom à partir du prénom repris du compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Steppers Adultes / Enfants : ajoute ou retire des membres en fin de groupe, absences comprises. */
  const setCount = (kind: "adult" | "child", n: number) => {
    const rows = data.household.members.map((m, i) => ({
      m,
      away: answers.away[i] ?? { lunch: false, dinner: false },
    }));
    const adults = rows.filter((r) => r.m.kind === "adult");
    const children = rows.filter((r) => r.m.kind === "child");
    const group = kind === "adult" ? adults : children;
    while (group.length < n)
      group.push({
        m: { name: "", kind, birthdate: null, schoolId: null, canteenDays: [1, 2, 4, 5] },
        away: { lunch: false, dinner: false },
      });
    group.length = n;
    const next = [...adults, ...children];
    update((d) => {
      d.household.members = next.map((r) => r.m);
    });
    setAnswers((a) => ({ ...a, away: next.map((r) => r.away) }));
  };

  const skip = skipFromAnswers(answers);
  const meals = plannedMeals(skip, data.rhythm.weekend);
  const errors = householdErrors(data);
  const people = data.household.members.length;
  const preview = dishes.previews[previewKey(data.diet.diet, data.diet.goals)] ?? [];

  const go = (s: Screen) => {
    setScreen(s);
    setError(undefined);
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    if (screen === "household" && errors) {
      setTried(true);
      return;
    }
    const i = STEPS.indexOf(screen as Step);
    if (i < STEPS.length - 1) go(STEPS[i + 1]!);
    else finish();
  };
  const back = () => {
    const i = STEPS.indexOf(screen as Step);
    go(i > 0 ? STEPS[i - 1]! : "welcome");
  };

  const run = (action: () => Promise<{ ok: false; error: string; retry?: true } | void>) => {
    setScreen("generating");
    window.scrollTo({ top: 0 });
    startTransition(async () => {
      const res = await action();
      // En cas de succès, l'action redirige vers le récapitulatif.
      if (!res) return;
      setError(res.error);
      setScreen(res.retry ? "failure" : "household");
    });
  };
  const finish = () =>
    run(() =>
      completeOnboarding({
        ...data,
        rhythm: { ...data.rhythm, skip, absences: absencesFrom(answers.away.slice(0, people)) },
      }),
    );

  if (screen === "generating") return <Generating dishes={dishes} />;
  if (screen === "failure")
    return (
      <Failure
        people={people}
        diet={t.envies.diets[data.diet.diet].name}
        restricted={data.diet.allergens.length + data.diet.refused.length > 0}
        meals={meals}
        duration={dur(data.rhythm.session.maxMinutes)}
        pending={pending}
        onRetry={() => run(retryFirstWeek)}
        onReview={() => go("rhythm")}
      />
    );

  const step = STEPS.indexOf(screen as Step);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-bg">
      {screen === "welcome" ? (
        <header className="flex min-h-11 items-center px-4 py-3">
          <Logo className="size-10 text-xl" />
        </header>
      ) : (
        <header className="flex min-h-11 items-center gap-3 px-4 py-3">
          <IconButton type="button" icon="arrowBack" label={fr.onboarding.back} onClick={back} />
          <div className="min-w-0 flex-1">
            <ProgressBar
              value={((step + 1) / STEPS.length) * 100}
              label={t.progress(step + 1, STEPS.length)}
            />
          </div>
          <span className="t-kicker">
            {step + 1} / {STEPS.length}
          </span>
          {screen !== "household" && (
            <button
              type="button"
              className="lnk min-h-11 px-1"
              onClick={() => (screen === "rhythm" ? finish() : next())}
            >
              {t.skip}
            </button>
          )}
        </header>
      )}

      <main className="flex flex-1 flex-col gap-8 px-4 pt-2 pb-6">
        {screen === "welcome" && (
          <WelcomeStep
            dishes={dishes}
            firstName={fromAccount ? (initial.household.members[0]?.name ?? "") : ""}
            associationName={associationName}
          />
        )}
        {screen === "household" && (
          <HouseholdStep
            data={data}
            update={(fn) => {
              const before = data.household.name;
              setData((d) => {
                const nextData = structuredClone(d);
                fn(nextData);
                if (nextData.household.name !== before) setNameTouched(true);
                else if (!nameTouched)
                  nextData.household.name = t.household.defaultName(
                    nextData.household.members[0]?.name.trim() ?? "",
                  );
                return nextData;
              });
            }}
            setCount={setCount}
            errors={tried ? errors : null}
            schools={schools}
            associationName={associationName}
            fromAccount={fromAccount}
          />
        )}
        {screen === "envies" && <EnviesStep data={data} update={update} dishes={dishes} />}
        {screen === "restrictions" && (
          <RestrictionsStep data={data} update={update} ingredients={ingredients} />
        )}
        {screen === "rhythm" && (
          <RhythmStep data={data} update={update} answers={answers} setAnswers={setAnswers} />
        )}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t-[length:var(--bw)] border-line bg-surface px-4 pt-3 pb-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {screen === "household" && tried && errors && (
          <p role="alert" className="t-small m-0 flex items-center gap-2 font-bold">
            <Icon name="warning" className="size-5" />
            {t.household.missing(countErrors(errors))}
          </p>
        )}
        {(screen === "household" || screen === "rhythm") && (
          <div className="flex items-center gap-3">
            <MealFrieze count={Math.max(1, meals)} size={10} />
            <p className="t-small m-0" aria-live="polite">
              {screen === "household"
                ? t.household.preview(people, meals)
                : t.rhythm.preview(
                    meals,
                    dur(data.rhythm.session.maxMinutes),
                    answers.precise ? "" : t.rhythm.moments[answers.moment].short,
                  )}
            </p>
          </div>
        )}
        {screen === "envies" && (
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="flex shrink-0 gap-1">
              {preview.map((d) => (
                <DishPhoto
                  key={d.id}
                  dish={d}
                  format="carre"
                  sizes="52px"
                  className="nb-sm w-13 overflow-hidden"
                />
              ))}
            </div>
            <p className="t-small m-0 min-w-0" aria-live="polite">
              {t.envies.preview} <strong>{preview.map((d) => d.name.toLowerCase()).join(", ")}</strong>
            </p>
          </div>
        )}
        {screen === "restrictions" && (
          <p className="t-small m-0 flex items-center gap-2" aria-live="polite">
            <Icon name="prohibit" className="size-5" />
            <strong>
              {data.diet.allergens.length + data.diet.refused.length
                ? t.restrictions.summary(data.diet.allergens.length, data.diet.refused.length)
                : t.restrictions.none}
            </strong>
          </p>
        )}
        {screen === "welcome" ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="btn--block"
              onClick={() => go("household")}
            >
              {t.welcome.start}
              <Icon name="arrowRight" className="size-5" />
            </Button>
            <p className="t-small muted m-0 text-center">{t.welcome.later}</p>
          </>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="btn--block"
            onClick={next}
            disabled={pending}
          >
            {screen === "rhythm" ? t.finish : t.continue}
            <Icon name="arrowRight" className="size-5" />
          </Button>
        )}
      </footer>
    </div>
  );
}

/** Attente de la génération : des plats qui défilent et les étapes qui se cochent. */
function Generating({ dishes }: { dishes: OnboardingDishes }) {
  const g = t.generation;
  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const id = window.setInterval(() => setTick((x) => x + 1), 1400);
    return () => window.clearInterval(id);
  }, []);
  const list = dishes.showcase;
  const at = (k: number) => list[((((reduced ? 0 : tick) + k) % list.length) + list.length) % list.length]!;
  const done = Math.min(2, tick);
  const rows = [
    { label: g.dishes, icon: "menu" as const },
    { label: g.session, icon: "timer" as const },
    { label: g.shopping, icon: "basket" as const },
  ];
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-bg" aria-busy="true">
      <header className="flex min-h-11 items-center px-4 py-3">
        <Logo className="size-10 text-xl" />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-6 px-4 pb-8">
        <div aria-hidden="true" className="-mx-4 flex items-center justify-center gap-3 overflow-hidden py-4">
          <DishPhoto
            dish={at(-1)}
            format="portrait"
            sizes="120px"
            className="nb-sm w-[118px] shrink-0 overflow-hidden"
          />
          <div className="card w-44 shrink-0 -rotate-2 p-2">
            <DishPhoto
              key={at(0).id}
              dish={at(0)}
              format="portrait"
              sizes="176px"
              caption
              className="ob-pop"
            />
          </div>
          <DishPhoto
            dish={at(1)}
            format="portrait"
            sizes="120px"
            className="nb-sm w-[118px] shrink-0 overflow-hidden"
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="t-kicker m-0">{g.kicker}</p>
          <h1 className="t-1 m-0">{g.title}</h1>
          <p className="t-body m-0" aria-live="polite">
            {g.lead}
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r, i) => (
            <li key={r.label} className="flex min-h-11 items-center gap-3">
              <span
                className={`flex size-8 shrink-0 items-center justify-center border-[length:var(--bw)] border-line ${i < done ? "tone-success" : i === done ? "tone-session" : "border-dashed bg-surface text-muted"}`}
              >
                <Icon name={i < done ? "check" : r.icon} className="size-[18px]" />
              </span>
              <span className={`t-ui flex-1 ${i > done ? "muted" : ""}`}>{r.label}</span>
              {i === done && <span className="t-kicker">{g.ongoing}</span>}
            </li>
          ))}
        </ul>
        <ProgressBar value={Math.min(90, 25 + tick * 20)} label={g.progress} />
      </main>
    </div>
  );
}

/** Échec de la génération : rien n'est perdu, on réessaie ou on revoit le rythme. */
function Failure({
  people,
  diet,
  restricted,
  meals,
  duration,
  pending,
  onRetry,
  onReview,
}: {
  people: number;
  diet: string;
  restricted: boolean;
  meals: number;
  duration: string;
  pending: boolean;
  onRetry: () => void;
  onReview: () => void;
}) {
  const f = t.failure;
  const rows = [
    { icon: "household" as const, label: f.people(people) },
    { icon: "scales" as const, label: f.diet(diet, restricted) },
    { icon: "sunHorizon" as const, label: f.rhythm(meals, duration) },
  ];
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-bg">
      <header className="flex min-h-11 items-center px-4 py-3">
        <Logo className="size-10 text-xl" />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-6 px-4 pb-8">
        <div role="alert" className="nb tone-alerte flex flex-col gap-3 p-5">
          <Icon name="warning" className="size-8" />
          <h1 className="t-2 m-0">{f.title}</h1>
          <p className="t-body m-0">{f.lead}</p>
        </div>
        <div className="nb-flat flex flex-col bg-surface">
          <p className="t-kicker tone-chip m-0 border-b-[length:var(--bw)] border-line px-4 py-2">
            {f.answers}
          </p>
          {rows.map((r) => (
            <div key={r.label} className="flex min-h-11 items-center gap-3 px-4 py-2">
              <Icon name={r.icon} className="size-5" />
              <p className="t-ui m-0">{r.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="btn--block"
            onClick={onRetry}
            disabled={pending}
          >
            <Icon name="retry" className="size-5" />
            {f.retry}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="btn--block"
            onClick={onReview}
            disabled={pending}
          >
            <Icon name="arrowBack" className="size-5" />
            {f.review}
          </Button>
        </div>
        <p className="t-small muted m-0 text-center">
          {f.contact}{" "}
          <Link href="/contact" className="lnk">
            {f.contactLink}
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
