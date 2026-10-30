"use client";

import { PageHeader } from "@/components/ui/Layout";
import { useEffect, useState } from "react";
import { useMenuAction } from "@/components/menu/useMenuAction";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { dur } from "@/engine/format";
import type { SessionStep } from "@/engine/session";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { SessionDoneBanner } from "./SessionDoneBanner";
import { bankDoublesAction, updatePantryAfterSession } from "@/server/actions/stock";
import { useSession } from "./SessionProvider";
import { Card } from "@/components/ui/Card";

const t = fr.session;
const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Heure de départ : celle du démarrage réel, sinon l'heure prévue aujourd'hui. */
function startDate(startedAt: string | null, planned: string) {
  if (startedAt) return new Date(startedAt);
  const [h, m] = planned.split(":").map(Number) as [number, number];
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** Garde l'écran allumé pendant la session (Wake Lock API), et le redemande au retour sur l'onglet. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

/** Session guidée (maquette Session) : domaine Session = pêche, étape en grand, cases de 36 px, boutons de 60 px. */
export function SessionScreen({
  weekId,
  weekLabel,
  steps,
  total,
  plannedTime,
  maxMinutes,
  doublesToBank,
  pantryToUpdate,
}: {
  weekId: string;
  weekLabel: string;
  steps: SessionStep[];
  total: number;
  plannedTime: string;
  maxMinutes: number;
  doublesToBank: boolean;
  pantryToUpdate: boolean;
}) {
  const session = useSession();
  const row = session?.row?.week_id === weekId ? session.row : null;
  const canEdit = !!session?.canEdit;
  const started = !!row?.started_at;
  const [now, setNow] = useState(() => Date.now());
  const { run, pending } = useMenuAction();
  useWakeLock(started);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const begin = startDate(row?.started_at ?? null, plannedTime);
  const at = (minutes: number) => new Date(begin.getTime() + minutes * 60000);
  const end = at(total);

  if (!started) {
    return (
      <>
        <PageHeader title={fr.nav.session} />
        <Card tone="peach" className="flex flex-col gap-4" data-testid="session-start">
          <p className="t-kicker">{weekLabel}</p>
          <p className="num-xl">{dur(total)}</p>
          <p className="t-ui">{t.startCard(steps.length, hhmm(new Date(Date.now() + total * 60000)))}</p>
          {total > maxMinutes && <p className="callout tone-warning t-ui">{t.overMax(dur(maxMinutes))}</p>}
          {canEdit ? (
            <Button type="button" size="lg" className="self-start" onClick={() => session?.start()}>
              {t.start}
            </Button>
          ) : (
            <p className="t-small">{t.viewerWait}</p>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <div className="sh">
            <h2 className="t-2">{t.overview}</h2>
            <span className="rule" />
          </div>
          <ol>
            {steps.map((s, i) => (
              <li key={i} className="row">
                <span className="mono w-14 shrink-0 font-bold">{hhmm(new Date(Date.now() + s.start * 60000))}</span>
                <span className="row-main">
                  <b>{s.name}</b> <span className="t-small text-muted">· {s.where}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </>
    );
  }

  const index = Math.min(row!.current_step, steps.length - 1);
  const step = steps[index]!;
  const done = row!.tasks_done.done ?? {};
  const allDone = step.tasks.every((_, j) => done[`${index}-${j}`]);
  const delay = Math.round((now - at(step.start).getTime()) / 60000);
  const activeTimer = row!.timers.find((x) => x.step === index && !x.doneAt);
  const upcoming = steps.slice(index + 1, index + 4);
  const nextStep = steps[index + 1];

  return (
    <>
      <div className="tone-session nb flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="t-kicker mono">
            {hhmm(begin)} → {t.plannedEnd(hhmm(end))}
          </p>
          <p className="t-ui">{t.stepOf(index + 1, steps.length)}</p>
        </div>
        <Pill tone={delay > 2 ? "peach" : "green"} data-testid="session-delay">
          {delay > 2 ? t.late(delay) : delay < -2 ? t.ahead(-delay) : t.onTime}
        </Pill>
      </div>

      <div
        className="grid gap-[var(--bw)] border-[length:var(--bw)] border-line bg-line"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
        aria-label={t.stepOf(index + 1, steps.length)}
      >
        {steps.map((_, k) => (
          <span
            key={k}
            className={`block h-3.5 ${k < index ? "bg-ink" : k === index ? "bg-[var(--cta)]" : "bg-surface"}`}
          />
        ))}
      </div>

      <div className="grid gap-5 min-[900px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] min-[900px]:items-start">
        <section className="flex min-w-0 flex-col gap-5" data-testid="session-step" aria-labelledby="session-step-title">
          <div className="flex items-end gap-3">
            <span aria-hidden="true" className="t-hero mono !text-[96px] !leading-[.8] min-[900px]:!text-[120px]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex flex-col items-start gap-2 pb-1.5">
              <span aria-hidden="true" className="mono text-xl font-bold">
                / {steps.length}
              </span>
              <Pill>
                <Icon name="pot" />
                {step.where}
              </Pill>
              <span className="mono t-kicker">{hhmm(at(step.start))}</span>
            </div>
          </div>
          <h1 id="session-step-title" className="t-1 balance">
            {step.name}
          </h1>
          <ul className="card !py-1">
            {step.tasks.map((task, j) => {
              const key = `${index}-${j}`;
              return (
                <li key={key}>
                  <label className="row min-h-[var(--touch-session)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!done[key]}
                      disabled={!canEdit}
                      onChange={(e) => session?.setTask(key, e.target.checked)}
                      className="cb cb-lg"
                    />
                    <span className={`row-main t-ui !text-lg ${done[key] ? "text-muted line-through" : ""}`}>
                      {task}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {step.timer && canEdit && (
            <Card tone="peach" className="flex flex-col items-center gap-3 text-center">
              <p className="num-xl !text-[72px] min-[900px]:!text-[96px]" aria-hidden="true">
                {String(step.timer.minutes).padStart(2, "0")}:00
              </p>
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={!!activeTimer}
                onClick={() =>
                  session?.startTimer(`${step.name} · ${step.where.toLowerCase()}`, step.timer!.minutes, index)
                }
              >
                <Icon name="timer" />
                {activeTimer ? t.timerRunning : t.startTimer(step.timer.minutes)}
              </Button>
            </Card>
          )}
          {FEATURES.freezerAndLeftovers && step.actions && canEdit && (
            <div className="flex flex-wrap gap-2">
              {doublesToBank && step.actions.bankDoubles && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => bankDoublesAction(weekId))}
                >
                  {fr.stock.bankDoubles}
                </Button>
              )}
              {pantryToUpdate && step.actions.pantryUpdate && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => updatePantryAfterSession(weekId))}
                >
                  {fr.stock.update}
                </Button>
              )}
            </div>
          )}
          {nextStep && (
            <p className="t-small min-[900px]:hidden">
              <b className="mono">{t.then(hhmm(at(nextStep.start)))}</b> {nextStep.name} · {nextStep.where}
            </p>
          )}
        </section>
        <aside className="card hidden flex-col gap-1 min-[900px]:flex" aria-label={t.upcoming}>
          <div className="sh mb-1">
            <h2 className="t-2">{t.upcoming}</h2>
            <span className="rule" />
          </div>
          {upcoming.length === 0 && <p className="t-small text-muted">{t.lastStep}</p>}
          <ol>
            {upcoming.map((s, k) => (
              <li key={k} className="row">
                <span className="mono w-12 text-[22px] font-bold">{String(index + 2 + k).padStart(2, "0")}</span>
                <div className="row-main">
                  <p className="t-ui">{s.name}</p>
                  <p className="mono t-small">
                    {hhmm(at(s.start))} · {s.where}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {canEdit && index >= steps.length - 1 && allDone && <SessionDoneBanner weekId={weekId} />}
      {canEdit && (
        <nav
          className="tone-bg sticky bottom-24 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 border-t-[length:var(--bw)] border-line py-3 min-[900px]:bottom-0"
          aria-label={t.navigation}
        >
          <button
            type="button"
            aria-label={t.previous}
            disabled={index === 0}
            onClick={() => session?.setStep(index - 1)}
            className="btn btn--outline btn--lg !px-3"
          >
            <Icon name="arrowBack" />
          </button>
          <button
            type="button"
            disabled={index >= steps.length - 1}
            onClick={() => session?.setStep(index + 1)}
            className={`btn btn--lg ${allDone ? "btn--primary" : "btn--dark"}`}
            data-ready={allDone}
          >
            <span>{nextStep ? t.next(allDone ? nextStep.name : null) : t.finished}</span>
            <Icon name="chevronRight" />
          </button>
        </nav>
      )}
    </>
  );
}
