"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import type { ActionResult } from "@/server/errors";
import { applyToPendingWeek } from "@/server/actions/settings";
import { Card } from "@/components/ui/Card";

const t = fr.settings;

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

/**
 * Formulaire qui s'enregistre tout seul (§6) : 600 ms après la dernière modification, toast « Enregistré ».
 * Si le changement touche une semaine déjà préparée, propose de l'appliquer tout de suite.
 */
export function useAutosave<T>(
  initial: T,
  save: (value: T) => Promise<ActionResult<{ pendingWeekStart: string | null } | undefined>>,
) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pendingWeek, setPendingWeek] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus({ kind: "saving" });
      const res = await save(value);
      if (res.ok) {
        setStatus({ kind: "saved" });
        if (res.data && "pendingWeekStart" in res.data && res.data.pendingWeekStart) {
          setPendingWeek(res.data.pendingWeekStart);
        }
      } else setStatus({ kind: "error", message: res.error });
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, save]);

  const update = useCallback((fn: (draft: T) => T) => setValue((v) => fn(structuredClone(v))), []);
  return { value, update, status, pendingWeek, dismissPending: () => setPendingWeek(null) };
}

/** Toast d'état de l'enregistrement, annoncé aux lecteurs d'écran. */
export function SaveStatus({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  if (status.kind === "error") return <FormMessage tone="error">{status.message}</FormMessage>;
  return (
    <p
      role="status"
      className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-pill bg-ink px-5 py-3 text-sm font-bold text-surface shadow-float"
    >
      {status.kind === "saving" ? t.saving : `✓ ${t.saved}`}
    </p>
  );
}

/** « Appliquer à la semaine en préparation » ou « À partir de la prochaine ». */
export function ApplyPrompt({ start, onDone }: { start: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  return (
    <Card
      as="div"
      tone="yellow"
      padding="cozy"
      className="flex flex-col gap-3"
      role="region"
      aria-live="polite"
    >
      <p className="font-semibold">{t.apply.question(formatShort(start))}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await applyToPendingWeek(start);
              setMessage(
                res.ok ? { tone: "success", text: t.apply.done } : { tone: "error", text: res.error },
              );
              if (res.ok) setTimeout(onDone, 2500);
            })
          }
        >
          {t.apply.now}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onDone}>
          {t.apply.later}
        </Button>
      </div>
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
    </Card>
  );
}
