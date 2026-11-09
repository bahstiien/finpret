"use client";

import { IngredientPicker, type IngredientOption } from "@/components/settings/IngredientPicker";
import { Checkbox, Sticker } from "@/components/ui/Extras";
import { ChipToggle, Toggle } from "@/components/ui/Controls";
import { SelectField, TextField } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar, Callout } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { ALLERGENS } from "@/engine/catalog/allergens";
import { dur } from "@/engine/format";
import { GOALS, type Goal } from "@/engine/onboarding";
import type { Diet } from "@/engine/types";
import { fr } from "@/i18n/fr";
import type { OnboardingInput } from "@/lib/onboarding";
import { type MealAnswer, SESSION_MOMENTS, type SessionMoment } from "@/lib/onboarding-answers";
import { DIETS } from "@/lib/settings-options";
import type { OnboardingDishes } from "@/server/onboarding-data";
import { DishPhoto } from "./DishPhoto";

const t = fr.onboarding.flow;

export type Update = (fn: (draft: OnboardingInput) => void) => void;
export type SchoolOption = { id: string; name: string; city: string };

/** Réponses de l'étape Rythme, converties en créneaux et absences à la fin du parcours. */
export type RhythmAnswers = {
  lunch: MealAnswer;
  lunchDays: number[];
  dinner: MealAnswer;
  dinnerDays: number[];
  /** Absences par membre (même ordre que les membres). */
  away: { lunch: boolean; dinner: boolean }[];
  moment: SessionMoment;
  precise: boolean;
};

/** Erreurs de l'étape Foyer : nom du foyer, prénom et date de naissance par membre. */
export type HouseholdErrors = { name?: string; members: { name?: string; birthdate?: string }[] };

/** Pastille d'icône carrée des lignes de réglage. */
function IconBadge({ name, tone = "tone-chip" }: { name: IconName; tone?: string }) {
  return (
    <span className={`nb-sm flex size-10 shrink-0 items-center justify-center ${tone}`}>
      <Icon name={name} className="size-[22px]" />
    </span>
  );
}

/** Stepper compact (− valeur +) sans libellé visible : le libellé est écrit à côté. */
function MiniStepper({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  less,
  more,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  less?: string;
  more?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={less ?? `${label} : moins`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
      <output aria-live="polite" className="min-w-12 text-center">
        {format(value)}
      </output>
      <button
        type="button"
        aria-label={more ?? `${label} : plus`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
    </div>
  );
}

/** Ligne « icône, libellé, aide, contrôle » (steppers, interrupteurs). */
function SettingRow({
  icon,
  tone,
  title,
  hint,
  children,
  last = false,
}: {
  icon: IconName;
  tone?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${last ? "" : "border-b-[length:var(--bw)] border-line"}`}
    >
      <IconBadge name={icon} tone={tone} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t-ui">{title}</span>
        {hint && <span className="t-small muted">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

export function StepIntro({ kicker, title, lead }: { kicker: string; title: string; lead: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="t-kicker m-0">{kicker}</p>
      <h1 className="t-1 m-0">{title}</h1>
      <p className="t-body m-0">{lead}</p>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="t-2 m-0">{title}</h2>
      {hint && <p className="t-small muted m-0">{hint}</p>}
    </div>
  );
}

/* ---------- 0. Bienvenue ---------- */

const WELCOME_ICONS: IconName[] = ["household", "menu", "prohibit", "calendar"];

export function WelcomeStep({
  dishes,
  firstName,
  associationName,
}: {
  dishes: OnboardingDishes;
  firstName: string;
  associationName: string | null;
}) {
  const w = t.welcome;
  return (
    <>
      <div className="nb grid grid-cols-3 overflow-hidden" aria-hidden="true">
        {dishes.showcase.map((d, i) => (
          <DishPhoto
            key={d.id}
            dish={d}
            format="carre"
            sizes="(max-width: 640px) 33vw, 200px"
            priority={i < 3}
            className={`${i % 3 ? "border-l-[length:var(--bw)] border-line" : ""} ${i > 2 ? "border-t-[length:var(--bw)] border-line" : ""}`}
          />
        ))}
      </div>
      {associationName && (
        <Callout tone="success" icon="users" title={w.asso(associationName)}>
          {w.assoLead}
        </Callout>
      )}
      <div className="flex flex-col gap-2">
        <p className="t-kicker m-0">{w.kicker(firstName)}</p>
        <h1 className="t-1 m-0">{w.title}</h1>
        <p className="t-body m-0">{w.lead}</p>
      </div>
      <ol className="nb-sm m-0 flex list-none flex-col bg-surface p-0">
        {w.steps.map((label, i) => (
          <li
            key={label}
            className={`flex min-h-14 items-center gap-3 px-4 py-2 ${i < w.steps.length - 1 ? "border-b-[length:var(--bw)] border-line" : ""}`}
          >
            <span className="mono w-4 font-bold">{i + 1}</span>
            <Icon name={WELCOME_ICONS[i]!} />
            <span className="t-ui min-w-0 flex-1">{label}</span>
            {i === 0 ? <Pill tone="dark">{t.required}</Pill> : <Pill tone="chip">{t.optional}</Pill>}
          </li>
        ))}
      </ol>
    </>
  );
}

/* ---------- 1. Foyer ---------- */

export function HouseholdStep({
  data,
  update,
  setCount,
  errors,
  schools,
  associationName,
  fromAccount,
}: {
  data: OnboardingInput;
  update: Update;
  setCount: (kind: "adult" | "child", n: number) => void;
  errors: HouseholdErrors | null;
  schools: SchoolOption[];
  associationName: string | null;
  fromAccount: boolean;
}) {
  const h = t.household;
  const members = data.household.members;
  const adults = members.filter((m) => m.kind === "adult").length;
  const children = members.length - adults;
  let a = 0;
  let c = 0;
  return (
    <>
      <StepIntro kicker={h.kicker} title={h.title} lead={h.lead} />

      <section aria-label={h.title} className="nb-sm flex flex-col bg-surface">
        <SettingRow icon="user" title={h.adults} hint={h.adultsHint}>
          <MiniStepper
            label={h.adults}
            value={adults}
            min={1}
            max={10 - children}
            onChange={(n) => setCount("adult", n)}
          />
        </SettingRow>
        <SettingRow icon="baby" title={h.children} hint={h.childrenHint} last>
          <MiniStepper
            label={h.children}
            value={children}
            min={0}
            max={10 - adults}
            onChange={(n) => setCount("child", n)}
          />
        </SettingRow>
      </section>

      <div className="flex flex-col gap-3">
        <SectionTitle title={h.names} hint={h.namesHint} />
        {members.map((m, i) => {
          const adult = m.kind === "adult";
          const title = adult ? h.adult(++a) : h.child(++c);
          const err = errors?.members[i];
          return (
            <div key={i} className="nb-flat flex flex-col gap-3 bg-surface px-4 pt-3 pb-4">
              <div className="flex min-h-7 items-center gap-2">
                <Icon name={adult ? "user" : "baby"} className="size-5" />
                <p className="t-ui m-0 flex-1">{title}</p>
                {i === 0 && <Pill tone="chip">{h.you}</Pill>}
              </div>
              <div className={adult ? "" : "grid grid-cols-2 items-start gap-3"}>
                <TextField
                  id={`member-${i}`}
                  label={`${h.firstName} (${title})`}
                  value={m.name}
                  maxLength={40}
                  autoComplete="off"
                  help={err?.name ?? (i === 0 && fromAccount && m.name ? h.fromAccount : undefined)}
                  helpIcon={err?.name ? "warning" : undefined}
                  aria-invalid={err?.name ? true : undefined}
                  onChange={(e) =>
                    update((d) => {
                      d.household.members[i]!.name = e.target.value;
                    })
                  }
                />
                {!adult && (
                  <TextField
                    id={`member-${i}-birth`}
                    type="date"
                    label={`${h.birthdate} (${title})`}
                    value={m.birthdate ?? ""}
                    help={err?.birthdate}
                    helpIcon={err?.birthdate ? "warning" : undefined}
                    aria-invalid={err?.birthdate ? true : undefined}
                    onChange={(e) =>
                      update((d) => {
                        d.household.members[i]!.birthdate = e.target.value || null;
                      })
                    }
                  />
                )}
              </div>
              {!adult && schools.length > 0 && (
                <div className="flex flex-col gap-2">
                  <SelectField
                    id={`member-${i}-school`}
                    label={`${h.school}${associationName ? ` (${associationName})` : ""}`}
                    value={m.schoolId ?? ""}
                    onChange={(e) =>
                      update((d) => {
                        d.household.members[i]!.schoolId = e.target.value || null;
                      })
                    }
                  >
                    <option value="">{h.noSchool}</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </SelectField>
                  <p className="t-small muted m-0">{h.schoolHelp}</p>
                  {m.schoolId && (
                    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                      <legend className="field-label mb-2 p-0">{h.canteen}</legend>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((day) => (
                          <ChipToggle
                            key={day}
                            pressed={m.canteenDays.includes(day)}
                            onToggle={() =>
                              update((d) => {
                                const list = d.household.members[i]!.canteenDays;
                                d.household.members[i]!.canteenDays = list.includes(day)
                                  ? list.filter((x) => x !== day)
                                  : [...list, day].sort();
                              })
                            }
                          >
                            {fr.days[day - 1]!.slice(0, 3)}
                          </ChipToggle>
                        ))}
                      </div>
                      <p className="t-small muted m-0">{h.canteenHint(m.name)}</p>
                    </fieldset>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TextField
        id="household-name"
        label={h.householdName}
        value={data.household.name}
        maxLength={60}
        help={errors?.name ?? h.householdNameHelp}
        helpIcon={errors?.name ? "warning" : undefined}
        aria-invalid={errors?.name ? true : undefined}
        onChange={(e) =>
          update((d) => {
            d.household.name = e.target.value;
          })
        }
      />
    </>
  );
}

/* ---------- 2. Envies ---------- */

const DIET_ICONS: Record<Diet, IconName> = {
  omnivore: "scales",
  flexitarien: "plant",
  vegetarien: "carrot",
  pescetarien: "fish",
  carnivore: "cow",
};
const GOAL_ICONS: Record<Goal, IconName> = { sportif: "barbell", economique: "piggy" };

/** Carte photo à toucher : choix unique (radio) ou cumulable (bouton pressé). */
function PhotoCard({
  dish,
  icon,
  name,
  desc,
  selected,
  role,
  onSelect,
  format = "paysage",
  badge,
}: {
  dish: OnboardingDishes["showcase"][number];
  icon: IconName;
  name: string;
  desc: string;
  selected: boolean;
  role: "radio" | "toggle";
  onSelect: () => void;
  format?: "paysage" | "large";
  badge?: string;
}) {
  return (
    <button
      type="button"
      role={role === "radio" ? "radio" : undefined}
      aria-checked={role === "radio" ? selected : undefined}
      aria-pressed={role === "toggle" ? selected : undefined}
      onClick={onSelect}
      className={`relative flex min-w-0 cursor-pointer flex-col border-[length:var(--bw)] border-line bg-surface p-0 text-left text-ink ${selected ? "shadow-[var(--sh)]" : "shadow-[var(--sh-sm)]"}`}
    >
      <DishPhoto
        dish={dish}
        format={format}
        sizes={format === "large" ? "(max-width: 640px) 100vw, 560px" : "(max-width: 640px) 50vw, 280px"}
      />
      <span
        className={`flex min-h-11 items-center gap-2 border-t-[length:var(--bw)] border-line px-3 py-2 ${selected ? "tone-sel" : ""}`}
      >
        <Icon name={icon} className={format === "large" ? "size-[26px]" : "size-5"} />
        <span className="t-ui min-w-0 flex-1">{name}</span>
        {selected && <Icon name="check" className="size-5" />}
      </span>
      <span className="t-small block flex-1 border-t-[length:var(--bw)] border-line px-3 pt-2 pb-3">
        {desc}
      </span>
      {badge && (
        <span className="absolute top-3 left-3">
          <Sticker>{badge}</Sticker>
        </span>
      )}
    </button>
  );
}

export function EnviesStep({
  data,
  update,
  dishes,
}: {
  data: OnboardingInput;
  update: Update;
  dishes: OnboardingDishes;
}) {
  const e = t.envies;
  const current = data.diet.diet;
  const goals = data.diet.goals;
  const card = (diet: Diet, format: "paysage" | "large" = "paysage") => (
    <PhotoCard
      key={diet}
      dish={dishes.diets[diet]}
      icon={DIET_ICONS[diet]}
      name={e.diets[diet].name}
      desc={e.diets[diet].desc}
      selected={current === diet}
      role="radio"
      format={format}
      badge={diet === "omnivore" ? e.byDefault : undefined}
      onSelect={() =>
        update((d) => {
          d.diet.diet = diet;
        })
      }
    />
  );
  return (
    <>
      <StepIntro kicker={e.kicker} title={e.title} lead={e.lead} />
      <section className="flex flex-col gap-3">
        <SectionTitle title={e.diet} hint={e.dietHint} />
        <div role="radiogroup" aria-label={e.diet} className="flex flex-col gap-3">
          {card("omnivore", "large")}
          <div className="grid grid-cols-2 gap-3">
            {DIETS.filter((d) => d !== "omnivore").map((d) => card(d))}
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle title={e.goals} hint={e.goalsHint} />
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map((g) => (
            <PhotoCard
              key={g}
              dish={dishes.goals[g]}
              icon={GOAL_ICONS[g]}
              name={e.goal[g].name}
              desc={e.goal[g].desc}
              selected={goals.includes(g)}
              role="toggle"
              onSelect={() =>
                update((d) => {
                  d.diet.goals = d.diet.goals.includes(g)
                    ? d.diet.goals.filter((x) => x !== g)
                    : [...d.diet.goals, g];
                })
              }
            />
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------- 3. Restrictions ---------- */

const ALLERGEN_ICONS: Record<keyof typeof ALLERGENS, IconName> = {
  gluten: "grains",
  crustaces: "shrimp",
  oeufs: "egg",
  poisson: "fish",
  arachides: "peanut",
  soja: "plant",
  lait: "drop",
  fruits_a_coque: "acorn",
  celeri: "leaf",
  moutarde: "jar",
  sesame: "sesame",
  sulfites: "wine",
  lupin: "flower",
  mollusques: "spiral",
};

export function RestrictionsStep({
  data,
  update,
  ingredients,
}: {
  data: OnboardingInput;
  update: Update;
  ingredients: IngredientOption[];
}) {
  const r = t.restrictions;
  return (
    <>
      <StepIntro kicker={r.kicker} title={r.title} lead={r.lead} />
      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="mb-3 flex flex-col gap-0.5 p-0">
          <span className="t-2 block">{r.allergens}</span>
          <span className="t-small muted block">{r.allergensHint}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(ALLERGENS) as [keyof typeof ALLERGENS, string][]).map(([key, label]) => {
            const on = data.diet.allergens.includes(key);
            return (
              <button
                key={key}
                type="button"
                className="chiptg"
                aria-pressed={on}
                onClick={() =>
                  update((d) => {
                    d.diet.allergens = on
                      ? d.diet.allergens.filter((x) => x !== key)
                      : [...d.diet.allergens, key];
                  })
                }
              >
                <Icon name={on ? "check" : ALLERGEN_ICONS[key]} className="size-[18px]" />
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <section className="flex flex-col gap-3">
        <SectionTitle title={r.refused} hint={r.refusedHint} />
        <IngredientPicker
          label={fr.onboarding.steps.diet.refusedSearch}
          options={ingredients}
          selected={data.diet.refused}
          onChange={(keys) =>
            update((d) => {
              d.diet.refused = keys;
            })
          }
        />
      </section>
    </>
  );
}

/* ---------- 4. Rythme ---------- */

const MOMENT_ICONS: Record<SessionMoment, IconName> = {
  dimanche: "sunHorizon",
  samedi: "coffee",
  soir: "moonStars",
};

function MealQuestion({
  icon,
  question,
  answer,
  days,
  daysLabel,
  onAnswer,
  onDays,
}: {
  icon: IconName;
  question: string;
  answer: MealAnswer;
  days: number[];
  daysLabel: string;
  onAnswer: (a: MealAnswer) => void;
  onDays: (d: number[]) => void;
}) {
  const r = t.rhythm;
  return (
    <div className="flex flex-col gap-2">
      <p className="t-ui m-0 flex items-center gap-2">
        <Icon name={icon} className="size-[22px]" />
        {question}
      </p>
      <Segmented
        block
        label={question}
        value={answer}
        options={(["oui", "certains", "non"] as const).map((v) => ({ value: v, label: r.answers[v] }))}
        onChange={onAnswer}
      />
      {answer === "certains" && (
        <div role="group" aria-label={daysLabel} className="flex flex-wrap gap-2 pt-1">
          {[1, 2, 3, 4, 5].map((day) => (
            <ChipToggle
              key={day}
              pressed={days.includes(day)}
              onToggle={() =>
                onDays(days.includes(day) ? days.filter((x) => x !== day) : [...days, day].sort())
              }
            >
              {fr.days[day - 1]!.slice(0, 3)}
            </ChipToggle>
          ))}
        </div>
      )}
    </div>
  );
}

export function RhythmStep({
  data,
  update,
  answers,
  setAnswers,
}: {
  data: OnboardingInput;
  update: Update;
  answers: RhythmAnswers;
  setAnswers: (fn: (a: RhythmAnswers) => RhythmAnswers) => void;
}) {
  const r = t.rhythm;
  const session = data.rhythm.session;
  const members = data.household.members;
  const pick = (moment: SessionMoment) => {
    setAnswers((a) => ({ ...a, moment, precise: false }));
    update((d) => {
      d.rhythm.session.day = SESSION_MOMENTS[moment].day;
      d.rhythm.session.time = SESSION_MOMENTS[moment].time;
    });
  };
  return (
    <>
      <StepIntro kicker={r.kicker} title={r.title} lead={r.lead} />

      <section className="flex flex-col gap-5">
        <h2 className="t-2 m-0">{r.meals}</h2>
        <MealQuestion
          icon="sun"
          question={r.lunch}
          answer={answers.lunch}
          days={answers.lunchDays}
          daysLabel={r.lunchDays}
          onAnswer={(lunch) => setAnswers((a) => ({ ...a, lunch }))}
          onDays={(lunchDays) => setAnswers((a) => ({ ...a, lunchDays }))}
        />
        <MealQuestion
          icon="moon"
          question={r.dinner}
          answer={answers.dinner}
          days={answers.dinnerDays}
          daysLabel={r.dinnerDays}
          onAnswer={(dinner) => setAnswers((a) => ({ ...a, dinner }))}
          onDays={(dinnerDays) => setAnswers((a) => ({ ...a, dinnerDays }))}
        />
        <div className="nb-flat bg-surface px-4 py-2">
          <Toggle
            label={r.weekend}
            hint={r.weekendHint}
            checked={data.rhythm.weekend}
            onChange={(v) =>
              update((d) => {
                d.rhythm.weekend = v;
              })
            }
          />
        </div>
      </section>

      {members.length > 1 && (
        <section className="flex flex-col gap-3">
          <SectionTitle title={r.away} hint={r.awayHint} />
          <div className="nb-flat bg-surface px-4">
            <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-end gap-2 border-b-[length:var(--bw)] border-line pt-3 pb-2">
              <span className="t-kicker">{r.awayHead}</span>
              <span className="t-kicker text-center">{r.awayLunch}</span>
              <span className="t-kicker text-center">{r.awayDinner}</span>
            </div>
            {members.map((m, i) => {
              const name =
                m.name || (m.kind === "adult" ? t.household.adult(i + 1) : t.household.child(i + 1));
              const away = answers.away[i] ?? { lunch: false, dinner: false };
              return (
                <div
                  key={i}
                  className={`grid min-h-14 grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 ${i < members.length - 1 ? "border-b-[length:var(--bw)] border-line" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={name} className="size-9 text-sm" />
                    <span className="t-ui truncate">{name}</span>
                  </span>
                  {(["lunch", "dinner"] as const).map((meal) => (
                    <span key={meal} className="flex justify-center">
                      <Checkbox
                        label={r.awayLabel(name, meal)}
                        hideLabel
                        checked={away[meal]}
                        large
                        onChange={(e) => {
                          const on = e.target.checked;
                          setAnswers((a) => {
                            const next = members.map((_, j) => a.away[j] ?? { lunch: false, dinner: false });
                            next[i] = { ...next[i]!, [meal]: on };
                            return { ...a, away: next };
                          });
                        }}
                      />
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <SectionTitle title={r.session} hint={r.sessionHint} />
        <div role="radiogroup" aria-label={r.session} className="grid grid-cols-3 gap-2">
          {(Object.keys(SESSION_MOMENTS) as SessionMoment[]).map((m) => {
            const on = !answers.precise && answers.moment === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(m)}
                className={`flex min-h-26 min-w-0 cursor-pointer flex-col items-start gap-2 border-[length:var(--bw)] border-line p-3 text-left ${on ? "tone-sel shadow-[var(--sh)]" : "bg-surface text-ink shadow-[var(--sh-sm)]"}`}
              >
                <Icon name={MOMENT_ICONS[m]} className="size-7" />
                <span className="t-ui">{r.moments[m].name}</span>
              </button>
            );
          })}
        </div>
        {answers.precise ? (
          <div className="flex flex-wrap gap-3">
            <SelectField
              id="session-day"
              label={r.day}
              className="flex-1"
              value={session.day}
              onChange={(e) =>
                update((d) => {
                  d.rhythm.session.day = Number(e.target.value);
                })
              }
            >
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>
                  {fr.days[(d + 6) % 7]}
                </option>
              ))}
            </SelectField>
            <TextField
              id="session-time"
              type="time"
              label={r.time}
              className="flex-1"
              value={session.time}
              onChange={(e) =>
                update((d) => {
                  d.rhythm.session.time = e.target.value;
                })
              }
            />
          </div>
        ) : (
          <button
            type="button"
            className="lnk self-start text-left"
            onClick={() => setAnswers((a) => ({ ...a, precise: true }))}
          >
            {r.precise}
          </button>
        )}
        <div className="nb-flat flex items-center gap-3 bg-surface px-4 py-3">
          <IconBadge name="timer" tone="tone-session" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="t-ui">{r.duration}</span>
            <span className="t-small muted">{r.durationHint}</span>
          </span>
          <MiniStepper
            label={r.duration}
            value={session.maxMinutes}
            min={60}
            max={360}
            step={30}
            format={dur}
            less={r.less}
            more={r.more}
            onChange={(v) =>
              update((d) => {
                d.rhythm.session.maxMinutes = v;
              })
            }
          />
        </div>
        <p className="t-small muted m-0">{r.durationNote}</p>
      </section>
    </>
  );
}
