"use client";

import { useState, useTransition } from "react";
import { ChipToggle } from "@/components/ui/Controls";
import { FormMessage, SelectField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { saveMemberSchool } from "@/server/actions/settings";

const t = fr.ecole;

export type ChildSchool = { memberId: string; name: string; schoolId: string | null; days: number[] };
export type SchoolChoice = { id: string; name: string; city: string };

/** École et jours de cantine de chaque enfant : enregistrés dès qu'on change un réglage. */
export function ChildSchoolForm({ kids, schools }: { kids: ChildSchool[]; schools: SchoolChoice[] }) {
  const [rows, setRows] = useState(kids);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function change(memberId: string, patch: Partial<Pick<ChildSchool, "schoolId" | "days">>) {
    const previous = rows;
    const next = rows.map((r) => (r.memberId === memberId ? { ...r, ...patch } : r));
    setRows(next);
    const row = next.find((r) => r.memberId === memberId)!;
    start(async () => {
      const res = await saveMemberSchool({ memberId, schoolId: row.schoolId, days: row.days });
      if (!res.ok) {
        setRows(previous);
        setError(res.error);
      } else setError(undefined);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <div
          key={r.memberId}
          className="nb-dash flex flex-col gap-3 p-4"
          data-testid={`school-${r.name}`}
        >
          <SelectField
            id={`school-${r.memberId}`}
            label={`${t.school} de ${r.name}`}
            value={r.schoolId ?? ""}
            disabled={pending}
            onChange={(e) => change(r.memberId, { schoolId: e.target.value || null })}
          >
            <option value="">{t.noSchool}</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.city})
              </option>
            ))}
          </SelectField>
          {r.schoolId && (
            <div role="group" aria-label={`${t.canteenDays} de ${r.name}`} className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((day) => (
                <ChipToggle
                  key={day}
                  pressed={r.days.includes(day)}
                  onToggle={() =>
                    change(r.memberId, {
                      days: r.days.includes(day) ? r.days.filter((d) => d !== day) : [...r.days, day].sort(),
                    })
                  }
                >
                  {fr.days[day - 1]}
                </ChipToggle>
              ))}
            </div>
          )}
        </div>
      ))}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  );
}
