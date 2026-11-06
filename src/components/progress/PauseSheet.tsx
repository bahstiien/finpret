"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { fr } from "@/i18n/fr";
import { formatAbbr } from "@/lib/dates";
import { cancelPauseAction, planPauseAction } from "@/server/actions/progress";
import type { PauseOption } from "@/server/progress-view";

const t = fr.progress.streak;

/**
 * Feuille « Planifier une pause » (SPEC_PROGRES §3.5) : le jeton est rare, on le pose en deux gestes
 * (choisir la semaine, puis la poser). L'annulation se fait en un geste, sur la ligne.
 */
export function PauseSheet({ options, mode }: { options: PauseOption[]; mode: "plan" | "view" }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const run = (weekStart: string, cancel: boolean) =>
    start(async () => {
      const r = cancel ? await cancelPauseAction(weekStart) : await planPauseAction(weekStart);
      toast(r.ok ? (cancel ? fr.progress.toasts.cancelled : fr.progress.toasts.paused) : r.error, r.ok ? "info" : "error");
      if (r.ok && !cancel) setChoice(null);
    });

  return (
    <>
      <Button type="button" variant="outline" className="btn--block" onClick={() => setOpen(true)} data-testid="plan-pause">
        <Icon name="calendar" />
        {mode === "plan" ? t.planPause : t.seePause}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.planPause}>
        <p className="t-small muted">{t.planPauseHelp}</p>
        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className="t-kicker mb-2">{t.pickWeek}</legend>
          {options.map((o) => {
            const label = t.pauseWeek(formatAbbr(o.weekStart));
            if (o.planned)
              return (
                <div
                  key={o.weekStart}
                  data-planned="true"
                  className="flex min-h-14 items-center gap-3 border-t-[length:var(--bw)] border-line py-2"
                >
                  <Icon name="pause" className="size-5" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="t-ui">{label}</span>
                    <span className="t-small">{t.planned}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={pending}
                    onClick={() => run(o.weekStart, true)}
                    aria-label={`${t.cancelPause} : ${label}`}
                  >
                    {t.cancelShort}
                  </button>
                </div>
              );
            return (
              <label
                key={o.weekStart}
                className={`flex min-h-14 items-center gap-3 border-t-[length:var(--bw)] border-line py-2 ${
                  o.disabled ? "opacity-60" : "cursor-pointer"
                }`}
              >
                <input
                  type="radio"
                  name="pause-week"
                  value={o.weekStart}
                  disabled={o.disabled || pending}
                  checked={choice === o.weekStart}
                  onChange={() => setChoice(o.weekStart)}
                  className="size-5 accent-[var(--ink)]"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="t-ui">{label}</span>
                  {o.disabled && <span className="t-small">{t.unavailable}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
        <Button
          type="button"
          variant="dark"
          className="btn--block"
          disabled={!choice || pending}
          onClick={() => choice && run(choice, false)}
          data-testid="confirm-pause"
        >
          <Icon name="pause" />
          {t.confirmPause}
        </Button>
      </Sheet>
    </>
  );
}
