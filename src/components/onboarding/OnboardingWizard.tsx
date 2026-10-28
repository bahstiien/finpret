"use client";

import { useState, useTransition } from "react";
import { IngredientPicker, type IngredientOption } from "@/components/settings/IngredientPicker";
import { Button } from "@/components/ui/Button";
import { ChipToggle, SlotGrid, Stepper, Toggle } from "@/components/ui/Controls";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { ALLERGENS } from "@/engine/catalog/allergens";
import { dur } from "@/engine/format";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import type { OnboardingInput } from "@/lib/onboarding";
import { DIETS } from "@/lib/settings";
import { completeOnboarding } from "@/server/actions/onboarding";
import { Card } from "@/components/ui/Card";

const t = fr.onboarding;
type Step = "household" | "diet" | "rhythm" | "equipment" | "habits";
// SPEC_JANVIER : 4 étapes ; « habitudes » reste disponible derrière le drapeau (valeurs par défaut sinon).
const STEPS: readonly Step[] = FEATURES.onboardingHabits
  ? ["household", "diet", "rhythm", "equipment", "habits"]
  : ["household", "diet", "rhythm", "equipment"];
type Update = (fn: (draft: OnboardingInput) => OnboardingInput) => void;

export type SchoolOption = { id: string; name: string; city: string };

export function OnboardingWizard({
  initial,
  ingredients,
  schools = [],
  associationName = null,
}: {
  initial: OnboardingInput;
  ingredients: IngredientOption[];
  /** Écoles de l'association du code d'inscription (vide sans code valide). */
  schools?: SchoolOption[];
  associationName?: string | null;
}) {
  const [data, setData] = useState(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const update: Update = (fn) => setData((d) => fn(structuredClone(d)));
  const current: Step = STEPS[step]!;

  const stepError = (): string | undefined => {
    if (current !== "household") return undefined;
    if (!data.household.name.trim()) return fr.household.nameInvalid;
    if (data.household.members.some((m) => !m.name.trim())) return t.steps.household.memberName;
    if (data.household.members.some((m) => m.kind === "child" && !m.birthdate))
      return t.steps.household.birthdateMissing;
    return undefined;
  };

  const finish = () =>
    startTransition(async () => {
      const res = await completeOnboarding(data);
      // En cas de succès, l'action redirige vers le récapitulatif.
      if (res && !res.ok) setError(res.error);
    });

  const next = (skip = false) => {
    if (!skip) {
      const problem = stepError();
      if (problem) return setError(problem);
    }
    setError(undefined);
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-muted">{t.progress(step + 1, STEPS.length)}</p>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label={t.progress(step + 1, STEPS.length)}
          className="h-2 overflow-hidden rounded-pill bg-line"
        >
          <div
            className="h-full rounded-pill bg-violet transition-all duration-300 ease-base"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t.steps[current].title}</h1>
        <p className="text-muted">{t.steps[current].lead}</p>
      </div>

      <Card padding="cozy" className="flex flex-col gap-4">
        {current === "household" && (
          <HouseholdStep data={data} update={update} schools={schools} associationName={associationName} />
        )}
        {current === "diet" && <DietStep data={data} update={update} ingredients={ingredients} />}
        {current === "rhythm" && <RhythmStep data={data} update={update} />}
        {current === "equipment" && <EquipmentStep data={data} update={update} />}
        {current === "habits" && <HabitsStep data={data} update={update} />}
      </Card>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {pending && <FormMessage tone="success">{t.working}</FormMessage>}

      <div className="mt-auto flex flex-wrap items-center gap-3">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={pending}>
            {t.back}
          </Button>
        )}
        <Button type="button" className="flex-1" onClick={() => next()} disabled={pending}>
          {step === STEPS.length - 1 ? t.finish : t.next}
        </Button>
        {current !== "household" && (
          <button
            type="button"
            className="min-h-11 w-full text-sm font-semibold text-muted underline"
            onClick={() => next(true)}
            disabled={pending}
          >
            {t.skip}
          </button>
        )}
      </div>
    </div>
  );
}

function HouseholdStep({
  data,
  update,
  schools,
  associationName,
}: {
  data: OnboardingInput;
  update: Update;
  schools: SchoolOption[];
  associationName: string | null;
}) {
  const s = t.steps.household;
  const e = fr.ecole;
  const members = data.household.members;
  return (
    <>
      <TextField
        id="household-name"
        label={s.name}
        placeholder={s.namePlaceholder}
        value={data.household.name}
        maxLength={60}
        onChange={(e) => update((d) => ((d.household.name = e.target.value), d))}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">{s.members}</legend>
        {members.map((m, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-2xl bg-bg p-3">
            <TextField
              id={`member-${i}`}
              label={`${s.memberName} (${m.kind === "adult" ? s.adult : s.child})`}
              value={m.name}
              maxLength={40}
              className="min-w-40 flex-1"
              onChange={(e) => update((d) => ((d.household.members[i]!.name = e.target.value), d))}
            />
            {m.kind === "child" && (
              <TextField
                id={`member-${i}-birth`}
                type="date"
                label={s.birthdate}
                value={m.birthdate ?? ""}
                className="min-w-40"
                onChange={(e) =>
                  update((d) => ((d.household.members[i]!.birthdate = e.target.value || null), d))
                }
              />
            )}
            {m.kind === "child" && schools.length > 0 && (
              <div className="flex w-full flex-col gap-2">
                <SelectField
                  id={`member-${i}-school`}
                  label={`${e.school}${associationName ? ` (${associationName})` : ""}`}
                  value={m.schoolId ?? ""}
                  onChange={(ev) =>
                    update((d) => ((d.household.members[i]!.schoolId = ev.target.value || null), d))
                  }
                >
                  <option value="">{e.noSchool}</option>
                  {schools.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name} ({sc.city})
                    </option>
                  ))}
                </SelectField>
                <p className="text-sm text-muted">{e.schoolHint}</p>
                {m.schoolId && (
                  <div role="group" aria-label={e.canteenDays} className="flex flex-wrap gap-2">
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
                            return d;
                          })
                        }
                      >
                        {fr.days[day - 1]}
                      </ChipToggle>
                    ))}
                  </div>
                )}
              </div>
            )}
            {members.length > 1 && (
              <button
                type="button"
                aria-label={s.remove(m.name)}
                className="grid size-11 place-items-center rounded-full bg-chip text-lg"
                onClick={() =>
                  update((d) => ((d.household.members = d.household.members.filter((_, j) => j !== i)), d))
                }
              >
                ×
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {(["adult", "child"] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              variant="outline"
              disabled={members.length >= 10}
              onClick={() =>
                update(
                  (d) => (
                    d.household.members.push({
                      name: "",
                      kind,
                      birthdate: null,
                      schoolId: null,
                      canteenDays: [1, 2, 4, 5],
                    }),
                    d
                  ),
                )
              }
            >
              {kind === "adult" ? s.addAdult : s.addChild}
            </Button>
          ))}
        </div>
      </fieldset>
      {FEATURES.alternatingCustody && (
        <Toggle
          label={s.alternating}
          hint={s.alternatingHint}
          checked={data.household.alternating.enabled}
          onChange={(v) => update((d) => ((d.household.alternating.enabled = v), d))}
        />
      )}
      {FEATURES.alternatingCustody && data.household.alternating.enabled && (
        <TextField
          id="alternating-from"
          type="date"
          label={s.alternatingFrom}
          value={data.household.alternating.from ?? ""}
          onChange={(e) => update((d) => ((d.household.alternating.from = e.target.value || null), d))}
        />
      )}
    </>
  );
}

function DietStep({
  data,
  update,
  ingredients,
}: {
  data: OnboardingInput;
  update: Update;
  ingredients: IngredientOption[];
}) {
  const s = t.steps.diet;
  return (
    <>
      <SelectField
        id="diet"
        label={s.diet}
        value={data.diet.diet}
        onChange={(e) =>
          update((d) => ((d.diet.diet = e.target.value as OnboardingInput["diet"]["diet"]), d))
        }
      >
        {DIETS.map((k) => (
          <option key={k} value={k}>
            {fr.diets[k]}
          </option>
        ))}
      </SelectField>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{s.allergens}</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(ALLERGENS) as [keyof typeof ALLERGENS, string][]).map(([key, label]) => (
            <ChipToggle
              key={key}
              pressed={data.diet.allergens.includes(key)}
              onToggle={() =>
                update((d) => {
                  d.diet.allergens = d.diet.allergens.includes(key)
                    ? d.diet.allergens.filter((a) => a !== key)
                    : [...d.diet.allergens, key];
                  return d;
                })
              }
            >
              {label}
            </ChipToggle>
          ))}
        </div>
      </fieldset>
      <IngredientPicker
        label={s.refused}
        options={ingredients}
        selected={data.diet.refused}
        onChange={(keys) => update((d) => ((d.diet.refused = keys), d))}
      />
    </>
  );
}

function RhythmStep({ data, update }: { data: OnboardingInput; update: Update }) {
  const s = t.steps.rhythm;
  const slot = (day: number, meal: "lunch" | "dinner") => `${day}-${meal}`;
  const slotLabel = (day: number, meal: "lunch" | "dinner", on: boolean) =>
    `${fr.days[day - 1]} ${fr.meals[meal].toLowerCase()} : ${on ? "prévu" : "rien de prévu"}`;
  const weekdays = [1, 2, 3, 4, 5];
  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{s.grid}</h2>
        <SlotGrid
          days={weekdays}
          dayLabels={fr.daysShort}
          mealLabels={fr.meals}
          isOn={(d, m) => !data.rhythm.skip.includes(slot(d, m))}
          onToggle={(d, m) =>
            update((x) => {
              const k = slot(d, m);
              x.rhythm.skip = x.rhythm.skip.includes(k)
                ? x.rhythm.skip.filter((y) => y !== k)
                : [...x.rhythm.skip, k];
              return x;
            })
          }
          label={slotLabel}
        />
        <Toggle
          label={s.weekend}
          checked={data.rhythm.weekend}
          onChange={(v) => update((x) => ((x.rhythm.weekend = v), x))}
        />
      </div>
      {data.household.members.length > 1 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{s.presence}</h2>
          <p className="text-sm text-muted">{s.presenceHint}</p>
          {data.household.members.map((m, i) => (
            <details key={i} className="rounded-2xl bg-bg p-3">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">
                {m.name || `#${i + 1}`}
              </summary>
              <SlotGrid
                days={weekdays}
                dayLabels={fr.daysShort}
                mealLabels={fr.meals}
                isOn={(d, meal) =>
                  !data.rhythm.absences.some((a) => a.member === i && a.slot === slot(d, meal))
                }
                onToggle={(d, meal) =>
                  update((x) => {
                    const k = slot(d, meal);
                    const has = x.rhythm.absences.some((a) => a.member === i && a.slot === k);
                    x.rhythm.absences = has
                      ? x.rhythm.absences.filter((a) => !(a.member === i && a.slot === k))
                      : [...x.rhythm.absences, { member: i, slot: k }];
                    return x;
                  })
                }
                label={(d, meal, on) => `${m.name} — ${slotLabel(d, meal, on)}`}
              />
            </details>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{s.session}</h2>
        <div className="flex flex-wrap gap-3">
          <SelectField
            id="session-day"
            label={s.sessionDay}
            className="flex-1"
            value={data.rhythm.session.day}
            onChange={(e) => update((x) => ((x.rhythm.session.day = Number(e.target.value)), x))}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {fr.days[(d + 6) % 7]}
              </option>
            ))}
          </SelectField>
          <TextField
            id="session-time"
            type="time"
            label={s.sessionTime}
            className="flex-1"
            value={data.rhythm.session.time}
            onChange={(e) => update((x) => ((x.rhythm.session.time = e.target.value), x))}
          />
        </div>
        <Stepper
          label={s.sessionMax}
          value={data.rhythm.session.maxMinutes}
          min={60}
          max={360}
          step={30}
          format={dur}
          onChange={(v) => update((x) => ((x.rhythm.session.maxMinutes = v), x))}
        />
      </div>
    </>
  );
}

function EquipmentStep({ data, update }: { data: OnboardingInput; update: Update }) {
  const e = data.equipment;
  const set = <K extends keyof typeof e>(k: K, v: (typeof e)[K]) => update((d) => ((d.equipment[k] = v), d));
  return (
    <>
      <Stepper
        label={fr.equipment.ovenRacks}
        value={e.ovenRacks}
        min={0}
        max={4}
        onChange={(v) => set("ovenRacks", v)}
      />
      <Stepper
        label={fr.equipment.burners}
        value={e.burners}
        min={1}
        max={6}
        onChange={(v) => set("burners", v)}
      />
      {(
        ["airfryer", "microwave", "standMixer", "blender", "mixer", "pressureCooker", "freezer"] as const
      ).map((k) => (
        <Toggle key={k} label={fr.equipment[k]} checked={e[k]} onChange={(v) => set(k, v)} />
      ))}
    </>
  );
}

function HabitsStep({ data, update }: { data: OnboardingInput; update: Update }) {
  const s = t.steps.habits;
  return (
    <>
      <SelectField
        id="shopping-day"
        label={s.shoppingDay}
        value={data.habits.shoppingDay}
        onChange={(e) => update((d) => ((d.habits.shoppingDay = Number(e.target.value)), d))}
      >
        {fr.days.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </SelectField>
      <TextField
        id="dinner-time"
        type="time"
        label={s.dinnerTime}
        value={data.habits.dinnerTime}
        onChange={(e) => update((d) => ((d.habits.dinnerTime = e.target.value), d))}
      />
      <TextField
        id="thaw-time"
        type="time"
        label={s.thawTime}
        value={data.habits.thawTime}
        onChange={(e) => update((d) => ((d.habits.thawTime = e.target.value), d))}
      />
      <TextField
        id="store"
        label={s.store}
        value={data.habits.store}
        maxLength={60}
        onChange={(e) => update((d) => ((d.habits.store = e.target.value), d))}
      />
    </>
  );
}
