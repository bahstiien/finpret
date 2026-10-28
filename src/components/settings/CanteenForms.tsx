"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Controls";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import type { CanteenSettings } from "@/lib/settings";
import {
  importCanteenPdf,
  importCanteenUrl,
  saveCanteenDay,
  validateCanteenMenus,
} from "@/server/actions/canteen";
import { saveSettings } from "@/server/actions/settings";
import { SaveStatus, useAutosave } from "./Autosave";

const t = fr.settings.canteen;

export type CanteenChild = {
  id: string;
  name: string;
  days: number[];
  /** Prochains jours de cantine et menu enregistré (validé). */
  upcoming: { date: string; label: string; text: string }[];
  /** Menus importés en attente de validation. */
  pending: { date: string; label: string; text: string }[];
};

export function CanteenForm({
  initial,
  kids,
  canEdit,
}: {
  initial: CanteenSettings;
  kids: CanteenChild[];
  canEdit: boolean;
}) {
  const save = useCallback((v: CanteenSettings) => saveSettings("canteen", v), []);
  const { value: v, update, status } = useAutosave(initial, save);
  return (
    <>
      <Card className="flex flex-col gap-2">
        <Toggle
          label={t.alert}
          hint={t.alertHint}
          checked={v.alert}
          onChange={(alert) => update((d) => ({ ...d, alert }))}
        />
        <SaveStatus status={status} />
      </Card>
      {kids.length === 0 && (
        <Card>
          <p className="text-muted">{t.noChild}</p>
        </Card>
      )}
      {kids.map((kid) => (
        <ChildCanteen
          key={kid.id}
          kid={kid}
          canEdit={canEdit}
          url={v.urls[kid.id] ?? ""}
          onUrl={(url) =>
            update((d) => {
              const urls = { ...d.urls };
              if (url) urls[kid.id] = url;
              else delete urls[kid.id];
              return { ...d, urls };
            })
          }
        />
      ))}
    </>
  );
}

function ChildCanteen({
  kid,
  canEdit,
  url,
  onUrl,
}: {
  kid: CanteenChild;
  canEdit: boolean;
  url: string;
  onUrl: (url: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  const file = useRef<HTMLInputElement>(null);
  const run = (
    action: () => Promise<{ ok: true; data: { message: string } } | { ok: false; error: string }>,
  ) =>
    start(async () => {
      const res = await action();
      setMessage(res.ok ? { tone: "success", text: res.data.message } : { tone: "error", text: res.error });
      if (res.ok) router.refresh();
    });

  return (
    <Card className="flex flex-col gap-4" data-testid={`canteen-${kid.name}`}>
      <h2 className="text-xl font-bold">{t.menuFor(kid.name)}</h2>
      <p className="text-sm text-muted">
        {kid.days.length ? t.days(kid.days.map((d) => fr.days[d - 1]).join(", ")) : t.noDays}
      </p>

      {canEdit && (
        <div className="flex flex-col gap-2">
          <TextField
            id={`canteen-url-${kid.id}`}
            label={t.url}
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={url}
            onBlur={(e) => onUrl(e.target.value.trim())}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !url}
              onClick={() => run(() => importCanteenUrl(kid.id, url))}
            >
              {t.importUrl}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => file.current?.click()}>
              {t.importPdf}
            </Button>
            <input
              ref={file}
              type="file"
              accept="application/pdf"
              className="sr-only"
              aria-label={`${t.importPdf} (${kid.name})`}
              data-testid={`canteen-pdf-${kid.name}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const data = new FormData();
                data.set("memberId", kid.id);
                data.set("file", f);
                run(() => importCanteenPdf(data));
              }}
            />
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {pending ? t.importing : ""}
          </p>
          {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
        </div>
      )}

      {kid.pending.length > 0 && <PendingMenus kid={kid} canEdit={canEdit} onDone={run} />}

      {kid.upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">{t.upcoming}</h3>
          {kid.upcoming.map((d) => (
            <TextField
              key={`${d.date}-${d.text}`}
              id={`canteen-${kid.id}-${d.date}`}
              label={t.dayLabel(d.label)}
              defaultValue={d.text}
              maxLength={300}
              readOnly={!canEdit}
              onBlur={(e) => {
                const text = e.target.value.trim();
                if (text !== d.text) run(() => saveCanteenDay(kid.id, d.date, text));
              }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Écran de validation obligatoire des menus importés (§13). */
function PendingMenus({
  kid,
  canEdit,
  onDone,
}: {
  kid: CanteenChild;
  canEdit: boolean;
  onDone: (
    action: () => Promise<{ ok: true; data: { message: string } } | { ok: false; error: string }>,
  ) => void;
}) {
  const [rows, setRows] = useState(kid.pending.map((p) => ({ ...p, keep: true })));
  return (
    <fieldset className="flex flex-col gap-3 rounded-card bg-banana/25 p-4" data-testid="canteen-pending">
      <legend className="sr-only">{t.pending(rows.length)}</legend>
      <p className="font-bold">{t.pending(rows.length)}</p>
      <p className="text-sm">{t.pendingLead}</p>
      {rows.map((r, i) => (
        <div key={r.date} className="flex flex-col gap-1">
          <TextField
            id={`pending-${kid.id}-${r.date}`}
            label={t.dayLabel(r.label)}
            value={r.text}
            maxLength={300}
            disabled={!r.keep || !canEdit}
            onChange={(e) =>
              setRows((rs) => rs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
            }
          />
          <Toggle
            label={t.keep}
            checked={r.keep}
            disabled={!canEdit}
            onChange={(keep) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, keep } : x)))}
          />
        </div>
      ))}
      {canEdit && (
        <Button
          type="button"
          className="self-start"
          onClick={() =>
            onDone(() =>
              validateCanteenMenus({
                memberId: kid.id,
                menus: rows.map((r) => ({ date: r.date, text: r.text, keep: r.keep })),
              }),
            )
          }
        >
          {t.validate}
        </Button>
      )}
    </fieldset>
  );
}
