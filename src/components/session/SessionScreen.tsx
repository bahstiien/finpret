"use client";

import { PageHeader } from "@/components/ui/Layout";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SessionTip } from "@/components/getting-started/SessionTip";
import { Segmented } from "@/components/ui/Segmented";
import type { FirstSessionTip } from "@/engine/getting-started";
import type { SessionLevel } from "@/engine/types";
import { setFirstSessionLevelAction } from "@/server/actions/getting-started";
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
/** Heure de Paris : le serveur (UTC) et le téléphone affichent la même chose, sans écart d'hydratation. */
const hhmm = (d: Date) =>
  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Heure de départ : celle du démarrage réel, sinon l'heure prévue aujourd'hui. */
function startDate(startedAt: string | null, planned: string) {
  if (startedAt) return new Date(startedAt);
  const [h, m] = planned.split(":").map(Number) as [number, number];
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** Garde l'écran allumé pendant la session (Wake Lock API), et le redemande au retour sur l'onglet. */
function useWakeLock(active: boolean): boolean {
  const [acquired, setAcquired] = useState(false);
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          lock = l;
          setAcquired(true);
        })
        .catch(() => {});
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
  return acquired;
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
  tip,
  firstSession = null,
}: {
  /** Bulle de la prise en main, ancrée sur la carte de démarrage. */
  tip?: React.ReactNode;
  /** Première session du foyer : niveau et conseils déjà vus (SPEC_PRISE_EN_MAIN §4.4). */
  firstSession?: { level: SessionLevel; seen: string[] } | null;
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
  // Horloge lue après le montage : le rendu serveur ne connaît pas l'heure du téléphone.
  const [now, setNow] = useState<number | null>(null);
  const { run, pending } = useMenuAction();
  const wakeAcquired = useWakeLock(started);
  const [fsDone, setFsDone] = useState<string[]>([]);
  // « Commencer ma session » : une confirmation courte, car le menu de la semaine sera figé.
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const router = useRouter();
  const [, startLevel] = useTransition();
  useEffect(() => {
    setNow(Date.now());
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
          <p className="t-ui" suppressHydrationWarning>
            {t.startCard(steps.length, hhmm(new Date((now ?? Date.now()) + total * 60000)))}
          </p>
          {total > maxMinutes && <p className="callout tone-warning t-ui">{t.overMax(dur(maxMinutes))}</p>}
          {firstSession && canEdit && (
            <div className="flex flex-col gap-1" data-testid="first-session-level">
              <Segmented<SessionLevel>
                label={fr.gettingStarted.firstSession.levelLabel}
                value={firstSession.level}
                options={[
                  { value: "beginner", label: fr.gettingStarted.firstSession.beginner },
                  { value: "confident", label: fr.gettingStarted.firstSession.confident },
                ]}
                onChange={(v) =>
                  startLevel(async () => {
                    await setFirstSessionLevelAction(v);
                    router.refresh();
                  })
                }
              />
              <p className="t-small">{fr.gettingStarted.firstSession.levelHint}</p>
            </div>
          )}
          {canEdit && confirming ? (
            <div className="flex flex-col gap-3" role="group" aria-label={t.start} data-testid="session-freeze">
              <p className="t-ui font-bold">{t.freezeConfirm}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  size="lg"
                  disabled={starting}
                  onClick={async () => {
                    setStarting(true);
                    await session?.start();
                    setStarting(false);
                  }}
                >
                  {t.freezeGo}
                </Button>
                <Button type="button" size="lg" variant="ghost" onClick={() => setConfirming(false)}>
                  {t.freezeCancel}
                </Button>
              </div>
            </div>
          ) : canEdit ? (
            <Button type="button" size="lg" className="self-start" onClick={() => setConfirming(true)}>
              {t.start}
            </Button>
          ) : (
            <p className="t-small">{t.viewerWait}</p>
          )}
        </Card>
        {tip}
        <Card className="flex flex-col gap-2">
          <div className="sh">
            <h2 className="t-2">{t.overview}</h2>
            <span className="rule" />
          </div>
          <ol>
            {steps.map((s, i) => (
              <li key={i} className="row">
                <span className="mono w-14 shrink-0 font-bold" suppressHydrationWarning>
                  {hhmm(new Date((now ?? Date.now()) + s.start * 60000))}
                </span>
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
  const delay = now === null ? null : Math.round((now - at(step.start).getTime()) / 60000);
  const activeTimer = row!.timers.find((x) => x.step === index && !x.doneAt);
  const upcoming = steps.slice(index + 1, index + 4);
  const nextStep = steps[index + 1];
  // Conseils de la première session : un seul à la fois, au bon moment (SPEC_PRISE_EN_MAIN §4.4.4).
  const fsGone = (key: FirstSessionTip) =>
    !firstSession || firstSession.seen.includes(key) || fsDone.includes(key);
  const fsTip: FirstSessionTip | null =
    canEdit && firstSession
      ? !fsGone("fs_next") && allDone && !!nextStep
        ? "fs_next"
        : !fsGone("fs_timers") && row!.timers.length > 0
          ? "fs_timers"
          : !fsGone("fs_wake") && wakeAcquired
            ? "fs_wake"
            : null
      : null;
  const fsClose = (key: FirstSessionTip) => () => setFsDone((d) => [...d, key]);

  return (
    <>
      <div className="tone-session nb flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="t-kicker mono">
            {hhmm(begin)} → {t.plannedEnd(hhmm(end))}
          </p>
          <p className="t-ui">{t.stepOf(index + 1, steps.length)}</p>
        </div>
        <Pill
          tone={delay !== null && delay > 2 ? "peach" : "green"}
          className={delay === null ? "invisible" : ""}
          data-testid="session-delay"
        >
          {delay === null || Math.abs(delay) <= 2 ? t.onTime : delay > 2 ? t.late(delay) : t.ahead(-delay)}
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
        <section
          className="flex min-w-0 flex-col gap-4 min-[900px]:gap-5"
          data-testid="session-step"
          aria-labelledby="session-step-title"
        >
          {/* Sur mobile, le bandeau dit déjà « Étape n sur N » : le grand numéro laisse la place aux actions. */}
          <div className="flex items-center gap-3 min-[900px]:items-end">
            <span
              aria-hidden="true"
              className="t-hero mono hidden !text-[120px] !leading-[.8] min-[900px]:block"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex flex-wrap items-center gap-2 min-[900px]:flex-col min-[900px]:items-start min-[900px]:pb-1.5">
              <span aria-hidden="true" className="mono hidden text-xl font-bold min-[900px]:inline">
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
          {step.recipe && (
            <p className="t-small -mt-2 text-muted min-[900px]:-mt-3" data-testid="session-recipe">
              {[
                step.recipe.name,
                t.recipePart(step.recipe.part, step.recipe.parts),
                t.work(step.recipe.active, step.recipe.passive),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {step.ingredients && step.ingredients.length > 0 && (
            <Card tone="yellow" className="flex flex-col gap-1.5 !py-3" data-testid="session-ingredients">
              <h2 className="t-kicker">{t.needs}</h2>
              {step.ingredients.some((x) => !x.again) && (
                <ul className="grid gap-x-6 gap-y-0.5 min-[1280px]:grid-cols-2">
                  {step.ingredients
                    .filter((x) => !x.again)
                    .map((x) => (
                      <li key={x.text} className="t-ui font-bold">
                        {x.text}
                      </li>
                    ))}
                </ul>
              )}
              {step.ingredients.some((x) => x.again) && (
                <p className="t-small opacity-75">
                  {t.alreadyOut(step.ingredients.filter((x) => x.again).map((x) => x.name))}
                </p>
              )}
            </Card>
          )}
          {fsTip === "fs_wake" && <SessionTip tip="fs_wake" onDone={fsClose("fs_wake")} />}
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
                  session?.startTimer(
                    `${step.name} · ${step.where.toLowerCase()}`,
                    step.timer!.minutes,
                    index,
                  )
                }
              >
                <Icon name="timer" />
                {activeTimer ? t.timerRunning : t.startTimer(step.timer.minutes)}
              </Button>
            </Card>
          )}
          {fsTip === "fs_timers" && <SessionTip tip="fs_timers" onDone={fsClose("fs_timers")} />}
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
                <span className="mono w-12 text-[22px] font-bold">
                  {String(index + 2 + k).padStart(2, "0")}
                </span>
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

      {fsTip === "fs_next" && <SessionTip tip="fs_next" onDone={fsClose("fs_next")} />}
      {canEdit && index >= steps.length - 1 && allDone && <SessionDoneBanner weekId={weekId} />}
      {canEdit && (
        <nav
          className="tone-bg sticky bottom-0 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 border-t-[length:var(--bw)] border-line pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          data-session-live
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
