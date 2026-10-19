"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SlotGrid, Stepper, Toggle } from "@/components/ui/Controls";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { fmtP } from "@/engine/format";
import { memberPortion, type Member, type PresenceRule } from "@/engine/portions";
import { fr } from "@/i18n/fr";
import { saveHousehold, saveMember, setPresence } from "@/server/actions/settings";
import { SaveStatus, useAutosave } from "./Autosave";

const t = fr.settings.household;

type Details = { name: string; timezone: string; alternatingFrom: string | null };

export function HouseholdDetailsForm({ initial, timezones }: { initial: Details; timezones: string[] }) {
  const save = useCallback(async (v: Details) => {
    const res = await saveHousehold(v);
    return res.ok ? { ok: true as const, data: undefined } : res;
  }, []);
  const { value: v, update, status } = useAutosave(initial, save);
  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-5">
      <h2 className="text-xl font-extrabold">{t.details}</h2>
      <TextField
        id="household-name"
        label={t.name}
        value={v.name}
        maxLength={60}
        onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
      />
      <SelectField
        id="timezone"
        label={t.timezone}
        value={v.timezone}
        onChange={(e) => update((d) => ({ ...d, timezone: e.target.value }))}
      >
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </SelectField>
      <Toggle
        label={t.alternating}
        hint={t.alternatingHint}
        checked={v.alternatingFrom !== null}
        onChange={(on) =>
          update((d) => ({ ...d, alternatingFrom: on ? new Date().toISOString().slice(0, 10) : null }))
        }
      />
      {v.alternatingFrom !== null && (
        <TextField
          id="alternating-from"
          type="date"
          label={t.alternatingFrom}
          value={v.alternatingFrom}
          onChange={(e) => update((d) => ({ ...d, alternatingFrom: e.target.value || null }))}
        />
      )}
      <SaveStatus status={status} />
    </section>
  );
}

type EditableMember = Member & { id: string };

export function MembersForm({
  members: initialMembers,
  presence: initialPresence,
  weekStart,
  alternating,
}: {
  members: EditableMember[];
  presence: PresenceRule[];
  weekStart: string;
  alternating: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [presence, setPresenceState] = useState(initialPresence);
  const [parity, setParity] = useState<"all" | "A" | "B">("all");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const saveRow = (m: EditableMember | (Omit<EditableMember, "id"> & { id: string | null })) =>
    startTransition(async () => {
      const res = await saveMember({
        id: m.id,
        name: m.name,
        kind: m.kind,
        birthdate: m.birthdate ?? null,
        portionOverride: m.portionOverride ?? null,
        archived: m.archived ?? false,
      });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      setMembers((list) =>
        m.id
          ? list.map((x) => (x.id === m.id ? { ...x, ...m, id: res.data.id } : x))
          : [...list, { ...m, id: res.data.id } as EditableMember],
      );
    });

  const present = (memberId: string, day: number, meal: "lunch" | "dinner") => {
    const rules = presence.filter((r) => r.memberId === memberId && r.weekday === day && r.meal === meal);
    const rule = rules.find((r) => r.weekParity === parity) ?? rules.find((r) => r.weekParity === "all");
    return rule ? rule.present : true;
  };

  const togglePresence = (memberId: string, day: number, meal: "lunch" | "dinner") => {
    const next = !present(memberId, day, meal);
    setPresenceState((list) => [
      ...list.filter(
        (r) => !(r.memberId === memberId && r.weekday === day && r.meal === meal && r.weekParity === parity),
      ),
      ...(next && parity === "all"
        ? []
        : [{ memberId, weekday: day, meal, present: next, weekParity: parity }]),
    ]);
    startTransition(async () => {
      const res = await setPresence({ memberId, weekday: day, meal, weekParity: parity, present: next });
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-5">
      <h2 className="text-xl font-extrabold">{t.members}</h2>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <ul className="flex flex-col gap-3">
        {members.map((m) => (
          <MemberRow key={m.id} member={m} weekStart={weekStart} pending={pending} onSave={saveRow} />
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        disabled={pending || members.length >= 10}
        onClick={() =>
          saveRow({
            id: null,
            name: `${fr.onboarding.steps.household.adult} ${members.length + 1}`,
            kind: "adult",
          })
        }
      >
        {t.add}
      </Button>
      {alternating && (
        <SelectField
          id="parity"
          label={t.alternating}
          value={parity}
          onChange={(e) => setParity(e.target.value as typeof parity)}
        >
          {(["all", "A", "B"] as const).map((p) => (
            <option key={p} value={p}>
              {t.parity[p]}
            </option>
          ))}
        </SelectField>
      )}
      {members
        .filter((m) => !m.archived)
        .map((m) => (
          <details key={m.id} className="rounded-2xl bg-bg p-3">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">
              {t.presence(m.name)}
            </summary>
            <SlotGrid
              days={[1, 2, 3, 4, 5, 6, 7]}
              dayLabels={fr.daysShort}
              mealLabels={fr.meals}
              isOn={(d, meal) => present(m.id, d, meal)}
              onToggle={(d, meal) => togglePresence(m.id, d, meal)}
              label={(d, meal, on) =>
                `${m.name}, ${fr.days[d - 1]} ${fr.meals[meal].toLowerCase()} : ${on ? "présent" : "absent"}`
              }
            />
          </details>
        ))}
    </section>
  );
}

function MemberRow({
  member,
  weekStart,
  pending,
  onSave,
}: {
  member: EditableMember;
  weekStart: string;
  pending: boolean;
  onSave: (m: EditableMember) => void;
}) {
  const [m, setM] = useState(member);
  const auto = memberPortion({ ...m, portionOverride: null }, weekStart);
  const dirty = JSON.stringify(m) !== JSON.stringify(member);
  return (
    <li className={`flex flex-col gap-3 rounded-2xl bg-bg p-4 ${m.archived ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          id={`m-${m.id}-name`}
          label={fr.onboarding.steps.household.memberName}
          className="min-w-40 flex-1"
          value={m.name}
          maxLength={40}
          onChange={(e) => setM({ ...m, name: e.target.value })}
        />
        <SelectField
          id={`m-${m.id}-kind`}
          label=""
          aria-label={m.name}
          value={m.kind}
          onChange={(e) => setM({ ...m, kind: e.target.value as Member["kind"] })}
        >
          <option value="adult">{fr.onboarding.steps.household.adult}</option>
          <option value="child">{fr.onboarding.steps.household.child}</option>
        </SelectField>
        {m.kind === "child" && (
          <TextField
            id={`m-${m.id}-birth`}
            type="date"
            label={fr.onboarding.steps.household.birthdate}
            value={m.birthdate ?? ""}
            onChange={(e) => setM({ ...m, birthdate: e.target.value || null })}
          />
        )}
        {m.archived && <Pill>{t.archived}</Pill>}
      </div>
      <Toggle
        label={t.portionOverride}
        hint={t.portionAuto(fmtP(auto))}
        checked={m.portionOverride != null}
        onChange={(on) => setM({ ...m, portionOverride: on ? auto : null })}
      />
      {m.portionOverride != null && (
        <Stepper
          label={t.portion}
          value={m.portionOverride}
          min={0.25}
          max={2}
          step={0.25}
          format={fmtP}
          onChange={(portionOverride) => setM({ ...m, portionOverride })}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!dirty || pending} onClick={() => onSave(m)}>
          {t.save}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => onSave({ ...m, archived: !m.archived })}
        >
          {m.archived ? t.unarchive : t.archive}
        </Button>
      </div>
    </li>
  );
}
