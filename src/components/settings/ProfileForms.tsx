"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import type { NotificationSettings } from "@/lib/settings";
import type { ActionResult } from "@/server/errors";
import { removePushSubscription, savePushSubscription, sendTestNotification } from "@/server/actions/push";
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

/** Clé publique VAPID (base64url) → tableau d'octets attendu par `pushManager.subscribe`. */
function vapidKey(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Abonne cet appareil aux notifications push ; renvoie un message d'erreur, ou null si c'est fait. */
async function subscribeDevice(): Promise<string | null> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return `${t.pushUnavailable} ${t.iosHint}`;
  }
  if (!publicKey) return t.pushNotConfigured;
  if ((await Notification.requestPermission()) !== "granted") return t.pushDenied;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(publicKey) }));
    const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
    return res.ok ? null : res.error;
  } catch {
    return t.pushUnavailable;
  }
}

async function unsubscribeDevice() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const sub = await registration?.pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscription(sub.endpoint);
  await sub.unsubscribe();
}

export function NotificationsForm({ initial }: { initial: NotificationSettings }) {
  const save = useCallback(async (v: NotificationSettings) => ok(await saveNotifications(v)), []);
  const { value: v, update, status } = useAutosave(initial, save);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        label={t.push}
        checked={v.push}
        disabled={pending}
        onChange={(push) =>
          startTransition(async () => {
            setMessage(undefined);
            if (push) {
              const error = await subscribeDevice();
              if (error) {
                setMessage({ tone: "error", text: error });
                return;
              }
            } else {
              await unsubscribeDevice();
            }
            update((d) => ({ ...d, push, consentAt: push ? new Date().toISOString() : d.consentAt }));
          })
        }
      />
      <Toggle
        label={t.email}
        checked={v.email}
        onChange={(email) =>
          update((d) => ({ ...d, email, consentAt: email ? (d.consentAt ?? new Date().toISOString()) : d.consentAt }))
        }
      />
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
      {v.push && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await sendTestNotification();
              setMessage(res.ok ? { tone: "success", text: res.data.message } : { tone: "error", text: res.error });
            })
          }
        >
          {t.test}
        </Button>
      )}
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
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
