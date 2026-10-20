"use client";

import { useEffect, useState } from "react";
import { useMenuAction } from "@/components/menu/useMenuAction";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { dur } from "@/engine/format";
import type { SessionStep } from "@/engine/session";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { SessionDoneBanner } from "./SessionDoneBanner";
import { bankDoublesAction, updatePantryAfterSession } from "@/server/actions/stock";
import { useSession } from "./SessionProvider";

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
        <h1 className="text-4xl font-black">{fr.nav.session}</h1>
        <section
          className="flex flex-col gap-4 rounded-card bg-blue-soft p-6 text-blue-ink"
          data-testid="session-start"
        >
          <p className="font-semibold">{weekLabel}</p>
          <p className="font-display text-5xl font-black">{dur(total)}</p>
          <p>{t.startCard(steps.length, hhmm(new Date(Date.now() + total * 60000)))}</p>
          {total > maxMinutes && (
            <p className="rounded-2xl bg-peach px-3 py-2 text-sm font-semibold text-peach-ink">
              {t.overMax(dur(maxMinutes))}
            </p>
          )}
          {canEdit ? (
            <Button type="button" className="self-start" onClick={() => session?.start()}>
              {t.start}
            </Button>
          ) : (
            <p className="text-sm">{t.viewerWait}</p>
          )}
        </section>
        <section className="flex flex-col gap-2 rounded-card bg-surface p-5">
          <h2 className="font-extrabold">{t.overview}</h2>
          <ol className="flex flex-col divide-y divide-line">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 py-2">
                <span className="w-14 shrink-0 font-display font-black">
                  {hhmm(new Date(Date.now() + s.start * 60000))}
                </span>
                <span>
                  <b>{s.name}</b> <span className="text-sm text-muted">· {s.where}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted">
            {hhmm(begin)} → {t.plannedEnd(hhmm(end))}
          </p>
          <p className="font-extrabold">{t.stepOf(index + 1, steps.length)}</p>
        </div>
        <span
          className={`rounded-pill px-3 py-1 text-sm font-bold ${delay > 2 ? "bg-peach text-peach-ink" : "bg-green-soft text-green-ink"}`}
          data-testid="session-delay"
        >
          {delay > 2 ? t.late(delay) : delay < -2 ? t.ahead(-delay) : t.onTime}
        </span>
      </div>

      <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          className="flex flex-col gap-4 rounded-card bg-blue-soft p-5 text-ink"
          data-testid="session-step"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-display text-5xl font-black text-blue-ink min-[900px]:text-7xl">
              {hhmm(at(step.start))}
            </span>
            <span className="inline-flex items-center gap-2 rounded-pill bg-surface px-4 py-2 font-bold text-blue-ink">
              <Icon name="pot" className="size-5" />
              {step.where}
            </span>
          </div>
          <h1 className="text-3xl font-black min-[900px]:text-4xl">{step.name}</h1>
          <ul className="flex flex-col divide-y divide-line rounded-3xl bg-surface px-4">
            {step.tasks.map((task, j) => {
              const key = `${index}-${j}`;
              return (
                <li key={key}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!done[key]}
                      disabled={!canEdit}
                      onChange={(e) => session?.setTask(key, e.target.checked)}
                      className="size-7 shrink-0 accent-green"
                    />
                    <span className={done[key] ? "text-muted line-through" : "font-semibold"}>{task}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {step.timer && canEdit && (
            <Button
              type="button"
              disabled={!!activeTimer}
              onClick={() =>
                session?.startTimer(`${step.name} · ${step.where.toLowerCase()}`, step.timer!.minutes, index)
              }
            >
              <Icon name="timer" />
              {activeTimer ? t.timerRunning : t.startTimer(step.timer.minutes)}
            </Button>
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
            <p className="text-sm min-[900px]:hidden">
              <b>{t.then(hhmm(at(nextStep.start)))}</b> {nextStep.name} · {nextStep.where}
            </p>
          )}
        </section>
        <aside
          className="hidden flex-col gap-1 rounded-card bg-nav p-5 text-on-nav min-[900px]:flex"
          aria-label={t.upcoming}
        >
          <h2 className="pb-2 text-sm font-bold tracking-wide uppercase opacity-70">{t.upcoming}</h2>
          {upcoming.length === 0 && <p className="opacity-70">{t.lastStep}</p>}
          {upcoming.map((s, k) => (
            <div key={k} className="border-t border-white/10 py-3">
              <p className={`font-display text-lg font-black ${k === 0 ? "text-banana" : ""}`}>
                {hhmm(at(s.start))}
              </p>
              <p className="font-bold">{s.name}</p>
              <p className="text-sm opacity-70">{s.where}</p>
            </div>
          ))}
        </aside>
      </div>

      {canEdit && index >= steps.length - 1 && allDone && <SessionDoneBanner weekId={weekId} />}
      {canEdit && (
        <nav className="sticky bottom-24 flex gap-3 min-[900px]:bottom-4" aria-label={t.navigation}>
          <button
            type="button"
            aria-label={t.previous}
            disabled={index === 0}
            onClick={() => session?.setStep(index - 1)}
            className="grid size-16 shrink-0 place-items-center rounded-pill bg-surface text-2xl font-bold shadow-float disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            disabled={index >= steps.length - 1}
            onClick={() => session?.setStep(index + 1)}
            className={`flex min-h-16 flex-1 items-center justify-between rounded-pill pr-2 pl-6 text-left font-bold shadow-float disabled:opacity-40 ${
              allDone ? "bg-green text-white" : "bg-nav text-on-nav"
            }`}
            data-ready={allDone}
          >
            <span>{nextStep ? t.next(allDone ? nextStep.name : null) : t.finished}</span>
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-full bg-surface text-xl text-ink"
            >
              →
            </span>
          </button>
        </nav>
      )}
    </>
  );
}
