"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { useSession } from "./SessionProvider";

const t = fr.session.timers;

const mmss = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Sonnerie courte (Web Audio), répétée tant qu'un minuteur prêt n'est pas validé. */
function beep(ctx: AudioContext) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = 880;
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.5);
}

/**
 * Barre de minuteurs persistante sur tous les onglets (§8.5) : compte à rebours, pilule jaune quand c'est prêt,
 * +5 min et OK, sonnerie et vibration selon les réglages du foyer.
 */
export function TimerBar() {
  const session = useSession();
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const timers = (session?.row?.timers ?? []).filter((x) => !x.doneAt);

  useEffect(() => {
    if (!timers.length) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timers.length]);

  const ready = timers.filter((x) => Date.parse(x.endsAt) <= now);
  useEffect(() => {
    if (!ready.length || !session) return;
    if (session.sound) {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
        beep(audio.current);
      } catch {
        // Audio indisponible (navigateur sans interaction) : la pilule et la vibration suffisent.
      }
    }
    if (session.vibration) navigator.vibrate?.([300, 150, 300]);
    // Une sonnerie toutes les 5 s tant qu'un minuteur prêt attend.
  }, [ready.length, Math.floor(now / 5000), session]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session || !timers.length) return null;
  return (
    <div
      role="region"
      aria-label={t.label}
      className="tone-dark sticky top-2 z-30 flex flex-wrap gap-2.5 border-[length:var(--bw)] border-line p-2.5"
      data-testid="timer-bar"
    >
      {timers.map((x) => {
        const left = (Date.parse(x.endsAt) - now) / 1000;
        const isReady = left <= 0;
        return (
          <div
            key={x.id}
            role={isReady ? "alert" : undefined}
            className={`nb-sm flex items-center gap-2 py-1 pr-1 pl-3 ${isReady ? "tone-banane" : "tone-surface"}`}
          >
            <Icon name={isReady ? "check" : "timer"} className="size-4" />
            <span className="t-small font-bold">{isReady ? t.ready(x.label) : x.label}</span>
            {!isReady && <span className="mono font-bold">{mmss(left)}</span>}
            {session.canEdit && (
              <>
                <button type="button" onClick={() => session.timerAction(x.id, "snooze")} className="btn btn--outline btn--sm !px-3">
                  {t.snooze}
                </button>
                {isReady && (
                  <button type="button" onClick={() => session.timerAction(x.id, "done")} className="btn btn--dark btn--sm !px-4">
                    {t.ok}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
