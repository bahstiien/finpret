"use client";

import { useCallback, useState } from "react";
import { IngredientPicker, type IngredientOption } from "@/components/settings/IngredientPicker";
import { Button } from "@/components/ui/Button";
import { ChipToggle, SlotGrid, Stepper, Toggle } from "@/components/ui/Controls";
import { SelectField, TextField } from "@/components/ui/Field";
import { ALLERGENS } from "@/engine/catalog/allergens";
import { CAKE_TYPES } from "@/engine/catalog/schema";
import { dur } from "@/engine/format";
import { fr } from "@/i18n/fr";
import {
  DIETS,
  type DietSettings,
  type EquipmentSettings,
  type MenuSettingsForm,
  SESSION_LEVELS,
  type SessionSettings,
  type ShoppingSettings,
} from "@/lib/settings";
import { saveSettings } from "@/server/actions/settings";
import { ApplyPrompt, SaveStatus, useAutosave } from "./Autosave";
import { Card } from "@/components/ui/Card";

const t = fr.settings;

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card padding="cozy" className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-extrabold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

export function DietForm({
  initial,
  ingredients,
}: {
  initial: DietSettings;
  ingredients: IngredientOption[];
}) {
  const save = useCallback((v: DietSettings) => saveSettings("diet", v), []);
  const { value: v, update, status, pendingWeek, dismissPending } = useAutosave(initial, save);
  const s = fr.onboarding.steps.diet;
  return (
    <>
      <Panel title={t.sections.diet}>
        <SelectField
          id="diet"
          label={s.diet}
          value={v.diet}
          onChange={(e) => update((d) => ({ ...d, diet: e.target.value as DietSettings["diet"] }))}
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
            {(Object.entries(ALLERGENS) as [DietSettings["allergens"][number], string][]).map(
              ([key, label]) => (
                <ChipToggle
                  key={key}
                  pressed={v.allergens.includes(key)}
                  onToggle={() =>
                    update((d) => ({
                      ...d,
                      allergens: d.allergens.includes(key)
                        ? d.allergens.filter((a) => a !== key)
                        : [...d.allergens, key],
                    }))
                  }
                >
                  {label}
                </ChipToggle>
              ),
            )}
          </div>
        </fieldset>
        <IngredientPicker
          label={s.refused}
          options={ingredients}
          selected={v.refused}
          onChange={(refused) => update((d) => ({ ...d, refused }))}
        />
      </Panel>
      <Panel title={t.diet.objectives}>
        <Stepper
          label={t.diet.minVeg}
          value={v.minVeg}
          min={0}
          max={5}
          onChange={(minVeg) => update((d) => ({ ...d, minVeg }))}
        />
        <Stepper
          label={t.diet.minProtein}
          value={v.minProtein}
          min={0}
          max={60}
          step={5}
          format={t.diet.grams}
          onChange={(minProtein) => update((d) => ({ ...d, minProtein }))}
        />
      </Panel>
      {pendingWeek && <ApplyPrompt start={pendingWeek} onDone={dismissPending} />}
      <SaveStatus status={status} />
    </>
  );
}

export function MenuForm({ initial }: { initial: MenuSettingsForm }) {
  const save = useCallback((v: MenuSettingsForm) => saveSettings("menu", v), []);
  const { value: v, update, status, pendingWeek, dismissPending } = useAutosave(initial, save);
  const m = t.menu;
  const slot = (d: number, meal: "lunch" | "dinner") => `${d}-${meal}`;
  return (
    <>
      <Panel title={m.proteins}>
        {(Object.keys(m.protein) as (keyof typeof m.protein)[]).map((p) => (
          <Stepper
            key={p}
            label={m.protein[p]}
            value={v.proteinCaps[p]}
            min={0}
            max={5}
            onChange={(n) => update((d) => ({ ...d, proteinCaps: { ...d.proteinCaps, [p]: n } }))}
          />
        ))}
      </Panel>
      <Panel title={t.sections.menu}>
        <Stepper
          label={m.pasta}
          value={v.pasta}
          min={1}
          max={2}
          onChange={(pasta) => update((d) => ({ ...d, pasta }))}
        />
        <Stepper
          label={m.ovenMax}
          value={v.ovenMax}
          min={0}
          max={5}
          onChange={(ovenMax) => update((d) => ({ ...d, ovenMax }))}
        />
        <Stepper
          label={m.light}
          value={v.light}
          min={0}
          max={4}
          onChange={(light) => update((d) => ({ ...d, light }))}
        />
        <p className="-mt-3 text-sm text-muted">{m.lightHint}</p>
        <Stepper
          label={m.world}
          value={v.world}
          min={0}
          max={3}
          onChange={(world) => update((d) => ({ ...d, world }))}
        />
        <SelectField
          id="comfort"
          label={m.comfort}
          value={String(v.comfort)}
          onChange={(e) =>
            update((d) => ({ ...d, comfort: Number(e.target.value) as MenuSettingsForm["comfort"] }))
          }
        >
          {(["0", "0.5", "1", "2"] as const).map((k) => (
            <option key={k} value={k}>
              {m.comfortOptions[k]}
            </option>
          ))}
        </SelectField>
        <Stepper
          label={m.bankUse}
          value={v.bankUse}
          min={0}
          max={4}
          onChange={(bankUse) => update((d) => ({ ...d, bankUse }))}
        />
        <Stepper
          label={m.noRepeat}
          value={v.noRepeatWeeks}
          min={2}
          max={6}
          format={m.weeks}
          onChange={(noRepeatWeeks) => update((d) => ({ ...d, noRepeatWeeks }))}
        />
      </Panel>
      <Panel title={m.grid} hint={m.gridHint}>
        <SlotGrid
          days={[1, 2, 3, 4, 5]}
          dayLabels={fr.daysShort}
          mealLabels={fr.meals}
          isOn={(d, meal) => !v.skip.includes(slot(d, meal))}
          onToggle={(d, meal) =>
            update((x) => {
              const k = slot(d, meal);
              return { ...x, skip: x.skip.includes(k) ? x.skip.filter((y) => y !== k) : [...x.skip, k] };
            })
          }
          label={(d, meal, on) =>
            `${fr.days[d - 1]} ${fr.meals[meal].toLowerCase()} : ${on ? "prévu" : "rien de prévu"}`
          }
        />
        <Toggle
          label={m.weekend}
          checked={v.weekend}
          onChange={(weekend) => update((d) => ({ ...d, weekend }))}
        />
      </Panel>
      <Panel title={m.cake}>
        <Toggle
          label={m.cake}
          checked={v.cake.enabled}
          onChange={(enabled) => update((d) => ({ ...d, cake: { ...d.cake, enabled } }))}
        />
        {v.cake.enabled && (
          <>
            <SelectField
              id="cake-day"
              label={m.cakeDay}
              value={v.cake.day}
              onChange={(e) => update((d) => ({ ...d, cake: { ...d.cake, day: Number(e.target.value) } }))}
            >
              {fr.days.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </SelectField>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-2 text-sm font-semibold">{m.cakeTypes}</legend>
              {CAKE_TYPES.map((type) => (
                <ChipToggle
                  key={type}
                  pressed={v.cake.types.includes(type)}
                  onToggle={() =>
                    update((d) => {
                      const types = d.cake.types.includes(type)
                        ? d.cake.types.filter((x) => x !== type)
                        : [...d.cake.types, type];
                      return types.length ? { ...d, cake: { ...d.cake, types } } : d;
                    })
                  }
                >
                  {m.cakeTypeLabels[type]}
                </ChipToggle>
              ))}
            </fieldset>
          </>
        )}
      </Panel>
      {pendingWeek && <ApplyPrompt start={pendingWeek} onDone={dismissPending} />}
      <SaveStatus status={status} />
    </>
  );
}

export function SessionForm({
  initial,
  equipment,
}: {
  initial: SessionSettings;
  equipment: EquipmentSettings;
}) {
  const saveSession = useCallback((v: SessionSettings) => saveSettings("session", v), []);
  const saveEquipment = useCallback((v: EquipmentSettings) => saveSettings("equipment", v), []);
  const session = useAutosave(initial, saveSession);
  const eq = useAutosave(equipment, saveEquipment);
  const v = session.value;
  const e = eq.value;
  const s = fr.onboarding.steps.rhythm;
  return (
    <>
      <Panel title={t.session.when}>
        <div className="flex flex-wrap gap-3">
          <SelectField
            id="session-day"
            label={s.sessionDay}
            className="flex-1"
            value={v.day}
            onChange={(ev) => session.update((d) => ({ ...d, day: Number(ev.target.value) }))}
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
            value={v.time}
            onChange={(ev) => session.update((d) => ({ ...d, time: ev.target.value }))}
          />
        </div>
        <Stepper
          label={s.sessionMax}
          value={v.maxMinutes}
          min={60}
          max={360}
          step={30}
          format={dur}
          onChange={(maxMinutes) => session.update((d) => ({ ...d, maxMinutes }))}
        />
        <SelectField
          id="session-level"
          label={t.session.level}
          value={v.level}
          onChange={(ev) =>
            session.update((d) => ({ ...d, level: ev.target.value as SessionSettings["level"] }))
          }
        >
          {SESSION_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t.session.levels[l]}
            </option>
          ))}
        </SelectField>
      </Panel>
      <Panel title={t.session.alerts}>
        <Toggle
          label={t.session.sound}
          checked={v.sound}
          onChange={(sound) => session.update((d) => ({ ...d, sound }))}
        />
        <Toggle
          label={t.session.vibration}
          checked={v.vibration}
          onChange={(vibration) => session.update((d) => ({ ...d, vibration }))}
        />
      </Panel>
      <Panel title={t.session.equipment}>
        <Stepper
          label={fr.equipment.ovenRacks}
          value={e.ovenRacks}
          min={0}
          max={4}
          onChange={(ovenRacks) => eq.update((d) => ({ ...d, ovenRacks }))}
        />
        <Stepper
          label={fr.equipment.burners}
          value={e.burners}
          min={1}
          max={6}
          onChange={(burners) => eq.update((d) => ({ ...d, burners }))}
        />
        {(
          ["airfryer", "microwave", "standMixer", "blender", "mixer", "pressureCooker", "freezer"] as const
        ).map((k) => (
          <Toggle
            key={k}
            label={fr.equipment[k]}
            checked={e[k]}
            onChange={(on) => eq.update((d) => ({ ...d, [k]: on }))}
          />
        ))}
      </Panel>
      <SaveStatus status={session.status.kind !== "idle" ? session.status : eq.status} />
    </>
  );
}

export function ShoppingForm({
  initial,
  aisles,
  baseIngredients,
}: {
  initial: ShoppingSettings;
  aisles: { key: string; label: string }[];
  baseIngredients: IngredientOption[];
}) {
  const save = useCallback((v: ShoppingSettings) => saveSettings("shopping", v), []);
  const { value: v, update, status } = useAutosave(initial, save);
  const [item, setItem] = useState("");
  const s = t.shopping;
  const order = [
    ...v.aisleOrder.filter((k) => aisles.some((a) => a.key === k)),
    ...aisles.map((a) => a.key).filter((k) => !v.aisleOrder.includes(k)),
  ];
  const label = (k: string) => aisles.find((a) => a.key === k)?.label ?? k;
  const move = (i: number, delta: number) =>
    update((d) => {
      const next = order.slice();
      const [x] = next.splice(i, 1);
      next.splice(i + delta, 0, x!);
      return { ...d, aisleOrder: next };
    });
  return (
    <>
      <Panel title={s.aisles} hint={s.aislesHint}>
        <ol className="flex flex-col gap-2">
          {order.map((k, i) => (
            <li
              key={k}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (!Number.isNaN(from) && from !== i) move(from, i - from);
              }}
              className="flex min-h-11 cursor-grab items-center justify-between gap-2 rounded-2xl bg-bg px-4"
            >
              <span className="font-semibold">
                <span aria-hidden="true" className="mr-2 text-muted">
                  ⋮⋮
                </span>
                {label(k)}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label={s.up(label(k))}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="grid size-11 place-items-center rounded-full disabled:opacity-30 hover:bg-chip"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={s.down(label(k))}
                  disabled={i === order.length - 1}
                  onClick={() => move(i, 1)}
                  className="grid size-11 place-items-center rounded-full disabled:opacity-30 hover:bg-chip"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title={s.recurring} hint={s.recurringHint}>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = item.trim();
            if (name && !v.recurring.includes(name))
              update((d) => ({ ...d, recurring: [...d.recurring, name] }));
            setItem("");
          }}
        >
          <TextField
            id="recurring"
            label={s.recurring}
            className="flex-1"
            placeholder={s.recurringPlaceholder}
            value={item}
            maxLength={60}
            onChange={(e) => setItem(e.target.value)}
          />
          <Button type="submit" variant="outline" className="self-end">
            {s.recurringAdd}
          </Button>
        </form>
        <ul className="flex flex-wrap gap-2">
          {v.recurring.map((r) => (
            <li key={r}>
              <button
                type="button"
                aria-label={s.remove(r)}
                className="min-h-11 rounded-pill bg-chip px-4 text-sm font-semibold"
                onClick={() => update((d) => ({ ...d, recurring: d.recurring.filter((x) => x !== r) }))}
              >
                {r} ×
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={s.base} hint={s.baseHint}>
        <div className="flex flex-wrap gap-2">
          {baseIngredients.map((b) => (
            <ChipToggle
              key={b.key}
              pressed={v.baseChecks.includes(b.key)}
              onToggle={() =>
                update((d) => ({
                  ...d,
                  baseChecks: d.baseChecks.includes(b.key)
                    ? d.baseChecks.filter((x) => x !== b.key)
                    : [...d.baseChecks, b.key],
                }))
              }
            >
              {b.label}
            </ChipToggle>
          ))}
        </div>
      </Panel>
      <Panel title={t.sections.shopping}>
        <SelectField
          id="shopping-day"
          label={fr.onboarding.steps.habits.shoppingDay}
          value={v.shoppingDay}
          onChange={(e) => update((d) => ({ ...d, shoppingDay: Number(e.target.value) }))}
        >
          {fr.days.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextField
          id="store"
          label={fr.onboarding.steps.habits.store}
          value={v.store}
          maxLength={60}
          onChange={(e) => update((d) => ({ ...d, store: e.target.value }))}
        />
        <SelectField
          id="export-format"
          label={s.exportFormat}
          value={v.exportFormat}
          onChange={(e) =>
            update((d) => ({ ...d, exportFormat: e.target.value as ShoppingSettings["exportFormat"] }))
          }
        >
          {(["text", "checklist"] as const).map((f) => (
            <option key={f} value={f}>
              {s.formats[f]}
            </option>
          ))}
        </SelectField>
      </Panel>
      <SaveStatus status={status} />
    </>
  );
}
