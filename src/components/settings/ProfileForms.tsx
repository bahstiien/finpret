"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import type { NotificationSettings } from "@/lib/settings";
import type { ActionResult } from "@/server/errors";
import { saveNotifications, saveProfile, signOutOtherDevices } from "@/server/actions/settings";
import { SaveStatus, useAutosave } from "./Autosave";

const t = fr.settings.profile;
const ok = (res: ActionResult) => (res.ok ? { ok: true as const, data: undefined } : res);

export function ProfileNameForm({ initial }: { initial: string }) {
  const save = useCallback(async (v: { displayName: string }) => ok(await saveProfile(v)), []);
  const { value, update, status } = useAutosave({ displayName: initial }, save);
  return (
    <>
      <TextField
        id="display-name"
        label={t.displayName}
        value={value.displayName}
        maxLength={60}
        onChange={(e) => update(() => ({ displayName: e.target.value }))}
      />
      <SaveStatus status={status} />
    </>
  );
}

export function NotificationsForm({ initial }: { initial: NotificationSettings }) {
  const save = useCallback(async (v: NotificationSettings) => ok(await saveNotifications(v)), []);
  const { value: v, update, status } = useAutosave(initial, save);
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        label={t.push}
        checked={v.push}
        onChange={(push) =>
          update((d) => ({ ...d, push, consentAt: push ? new Date().toISOString() : d.consentAt }))
        }
      />
      <Toggle label={t.email} checked={v.email} onChange={(email) => update((d) => ({ ...d, email }))} />
      {(["dinner", "thaw"] as const).map((k) => (
        <div key={k} className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Toggle
              label={t[k]}
              checked={v[k].enabled}
              onChange={(enabled) => update((d) => ({ ...d, [k]: { ...d[k], enabled } }))}
            />
          </div>
          {v[k].enabled && (
            <TextField
              id={`notif-${k}`}
              type="time"
              label={t.time}
              value={v[k].time}
              onChange={(e) => update((d) => ({ ...d, [k]: { ...d[k], time: e.target.value } }))}
            />
          )}
        </div>
      ))}
      <Toggle
        label={t.shoppingReady}
        checked={v.shoppingReady}
        onChange={(shoppingReady) => update((d) => ({ ...d, shoppingReady }))}
      />
      <Toggle
        label={t.sessionStart}
        checked={v.sessionStart}
        onChange={(sessionStart) => update((d) => ({ ...d, sessionStart }))}
      />
      <SaveStatus status={status} />
    </div>
  );
}

export function SignOutOthers() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await signOutOtherDevices();
            setMessage(
              res.ok ? { tone: "success", text: t.signedOutOthers } : { tone: "error", text: res.error },
            );
          })
        }
      >
        {t.signOutOthers}
      </Button>
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
    </div>
  );
}

/** Formulaire de confirmation forte (suppression du foyer ou du compte). */
export function ConfirmDelete({
  action,
  label,
  hint,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  label: string;
  hint: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await action(data);
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      <p className="text-sm text-muted">{hint}</p>
      <TextField
        id={`confirm-${label}`}
        name="confirm"
        label={fr.settings.data.confirmLabel}
        autoComplete="off"
        required
      />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" variant="dark" disabled={pending}>
        {label}
      </Button>
    </form>
  );
}
