"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { finishSessionAction, type SessionDoneResult } from "@/server/actions/progress";

const t = fr.progress;

// Mêmes aplats que la frise de « Nos progrès » : fin prête = encre, pause = banane, en cours = sélection.
const STYLE = {
  done: "tone-dark",
  paused: "tone-banane",
  neutral: "tone-chip",
  missed: "tone-surface",
  todo: "tone-sel",
  none: "tone-chip",
} as const;

/**
 * Fin de session : enregistre « session terminée » une fois la dernière étape cochée (une seule fois par semaine,
 * côté serveur), puis affiche la série, la frise des dernières semaines et le tampon obtenu (SPEC_PROGRES §3.5).
 * Rafraîchit la page pour que la feuille globale célèbre les éventuels tampons ou paliers.
 */
export function SessionDoneBanner({ weekId }: { weekId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<SessionDoneResult | null>(null);
  useEffect(() => {
    let active = true;
    void finishSessionAction(weekId).then((r) => {
      if (!active) return;
      setResult(r);
      router.refresh();
    });
    return () => {
      active = false;
    };
  }, [weekId, router]);
  if (!result?.visible || result.current < 1) return null;
  const stamp = result.stamps?.[0];
  return (
    <section className="card tone-progres flex flex-col gap-4" data-testid="session-streak">
      <div className="flex flex-wrap items-center gap-4">
        <Icon name="streak" className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="t-kicker">{t.streak.sessionEndKicker}</p>
          <p className="t-ui !text-lg">{t.streak.sessionDone(result.current)}</p>
        </div>
        <span aria-hidden="true" className="num-l">
          {result.current}
        </span>
      </div>
      {result.frise && result.frise.length > 0 && (
        <ol className="bento" style={{ gridTemplateColumns: `repeat(${result.frise.length}, minmax(0, 1fr))` }} aria-label={t.streak.friseEnd}>
          {result.frise.map((w) => (
            <li key={w.weekStart} data-state={w.state} className={`flex min-h-9 items-center justify-center ${STYLE[w.state]}`}>
              {w.state === "done" && <Icon name="check" className="size-4" />}
              {w.state === "paused" && <Icon name="pause" className="size-4" />}
            </li>
          ))}
        </ol>
      )}
      {stamp && (
        <p className="nb-flat tone-surface flex items-center gap-3 px-3 py-2" data-testid="session-new-stamp">
          <span className="mono font-bold">{t.passport.newStampKicker}</span>
          <span className="t-ui">{stamp.label}</span>
        </p>
      )}
      <Link href="/app/progress?from=session" className="lnk min-h-11 content-center self-start">
        {t.title}
      </Link>
    </section>
  );
}
