"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import {
  importSchoolMenusPdf,
  type MenuState,
  publishAllDrafts,
  saveSchoolMenu,
} from "@/server/actions/asso";
import { Card } from "@/components/ui/Card";

const t = fr.asso.menus;

export type MenuRow = {
  date: string;
  starter: string | null;
  main: string | null;
  side: string | null;
  dairy: string | null;
  dessert: string | null;
  note: string | null;
  status: "draft" | "published";
  edited: boolean;
  /** Menu saisi par une autre association de la même école : consultation seule. */
  readOnly: boolean;
  label: string;
};

const FIELDS = ["starter", "main", "side", "dairy", "dessert"] as const;

function DayForm({ schoolId, row, isNew = false }: { schoolId: string; row: MenuRow; isNew?: boolean }) {
  const [state, action, pending] = useActionState<MenuState, FormData>(saveSchoolMenu, {});
  if (row.readOnly) {
    return (
      <Card as="li" padding="sm">
        <p className="font-bold">{row.label}</p>
        <p>
          {FIELDS.map((f) => row[f])
            .filter(Boolean)
            .join(", ")}
        </p>
        <p className="text-sm text-muted">{t.readOnly}</p>
      </Card>
    );
  }
  return (
    <Card as="li" padding="sm" data-testid={`menu-${row.date || "new"}`}>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="schoolId" value={schoolId} />
        {isNew ? (
          <TextField id="new-date" name="date" type="date" label={t.date} required />
        ) : (
          <>
            <input type="hidden" name="date" value={row.date} />
            <p className="flex flex-wrap items-center gap-2 font-bold">
              {row.label}
              <span
                className={`rounded-pill px-3 py-0.5 text-sm ${row.status === "published" ? "bg-green-soft text-green-ink" : "bg-chip"}`}
              >
                {row.status === "published" ? t.published : t.draft}
              </span>
              {row.edited && <span className="text-sm font-semibold text-muted">{t.edited}</span>}
            </p>
          </>
        )}
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          {FIELDS.map((f) => (
            <TextField
              key={f}
              id={`${row.date || "new"}-${f}`}
              name={f}
              label={t[f]}
              defaultValue={row[f] ?? ""}
              maxLength={200}
            />
          ))}
          <TextField
            id={`${row.date || "new"}-note`}
            name="note"
            label={t.note}
            defaultValue={row.note ?? ""}
            maxLength={300}
          />
        </div>
        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.ok && <FormMessage tone="success">{state.ok}</FormMessage>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="intent" value="save" variant="outline" disabled={pending}>
            {t.save}
          </Button>
          {row.status !== "published" && (
            <Button type="submit" name="intent" value="publish" disabled={pending}>
              {t.publish}
            </Button>
          )}
          {!isNew && row.status === "draft" && (
            <Button type="submit" name="intent" value="delete" variant="outline" disabled={pending}>
              {t.remove}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

export function MenusEditor({
  schoolId,
  rows,
  importsUsed,
  importsMax,
  active,
}: {
  schoolId: string;
  rows: MenuRow[];
  importsUsed: number;
  importsMax: number;
  active: boolean;
}) {
  const [importState, importAction, importing] = useActionState<MenuState, FormData>(
    importSchoolMenusPdf,
    {},
  );
  const [publishState, publishAction, publishing] = useActionState<MenuState, FormData>(publishAllDrafts, {});
  const [adding, setAdding] = useState(false);
  const drafts = rows.some((r) => r.status === "draft" && !r.readOnly);
  const blank: MenuRow = {
    date: "",
    starter: null,
    main: null,
    side: null,
    dairy: null,
    dessert: null,
    note: null,
    status: "draft",
    edited: false,
    readOnly: false,
    label: "",
  };
  if (!active) return <FormMessage tone="success">{t.inactive}</FormMessage>;
  return (
    <div className="flex flex-col gap-4">
      <form action={importAction} className="flex flex-col gap-3 rounded-card bg-surface p-4">
        <input type="hidden" name="schoolId" value={schoolId} />
        <label htmlFor="pdf" className="text-sm font-semibold">
          {t.importLabel}
        </label>
        <input id="pdf" name="pdf" type="file" accept="application/pdf" required className="min-h-11" />
        <p className="text-sm text-muted">{t.importQuota(importsUsed, importsMax)}</p>
        {importState.error && <FormMessage tone="error">{importState.error}</FormMessage>}
        {importState.ok && <FormMessage tone="success">{importState.ok}</FormMessage>}
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={importing || importsUsed >= importsMax}
        >
          {t.importCta}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
          {t.addDay}
        </Button>
        {drafts && (
          <form action={publishAction}>
            <input type="hidden" name="schoolId" value={schoolId} />
            <Button type="submit" disabled={publishing}>
              {t.publishAll}
            </Button>
          </form>
        )}
      </div>
      {publishState.error && <FormMessage tone="error">{publishState.error}</FormMessage>}
      {publishState.ok && <FormMessage tone="success">{publishState.ok}</FormMessage>}

      <ul className="flex flex-col gap-3">
        {adding && <DayForm schoolId={schoolId} row={blank} isNew />}
        {rows.map((r) => (
          <DayForm key={r.date} schoolId={schoolId} row={r} />
        ))}
      </ul>
      {!rows.length && !adding && <p className="text-muted">{t.empty}</p>}
    </div>
  );
}
