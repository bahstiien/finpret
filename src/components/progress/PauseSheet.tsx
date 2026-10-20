"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { cancelPauseAction, planPauseAction } from "@/server/actions/progress";
import type { PauseOption } from "@/server/progress-view";

const t = fr.progress.streak;

/** « Planifier une pause » : les 8 prochaines semaines, désactivées s'il n'y a plus de jeton (SPEC_PROGRES §3.5). */
export function PauseSheet({ options, canEdit }: { options: PauseOption[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const toggle = (o: PauseOption) =>
    start(async () => {
      const r = o.planned ? await cancelPauseAction(o.weekStart) : await planPauseAction(o.weekStart);
      toast(
        r.ok ? (o.planned ? fr.progress.toasts.cancelled : fr.progress.toasts.paused) : r.error,
        r.ok ? "info" : "error",
      );
    });
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!canEdit}
        data-testid="plan-pause"
      >
        <Icon name="pause" />
        {t.planPause}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.planPause}>
        <p className="text-muted">{t.planPauseHelp}</p>
        <ul className="flex flex-col gap-2">
          {options.map((o) => (
            <li key={o.weekStart}>
              <button
                type="button"
                disabled={o.disabled || pending}
                onClick={() => toggle(o)}
                aria-pressed={o.planned}
                data-planned={o.planned}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left font-semibold disabled:opacity-50 ${
                  o.planned ? "bg-violet-soft text-violet-strong" : "bg-chip"
                }`}
              >
                <span>{t.pauseWeek(formatShort(o.weekStart))}</span>
                <span className="inline-flex items-center gap-1 text-sm">
                  {o.planned && <Icon name="pause" className="size-4" />}
                  {o.planned ? t.cancelPause : o.disabled ? t.noPauseLeft : t.planPause}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
