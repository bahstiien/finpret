"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { finishSessionAction, type SessionDoneResult } from "@/server/actions/progress";

/**
 * Fin de session : enregistre « session terminée » une fois la dernière étape cochée (une seule fois par semaine,
 * côté serveur), puis affiche la série (SPEC_PROGRES §3.5). Rafraîchit la page pour que la feuille globale célèbre
 * les éventuels tampons ou paliers.
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
  return (
    <section className="card tone-progres flex flex-wrap items-center gap-4" data-testid="session-streak">
      <Icon name="streak" className="size-8" />
      <p className="t-ui min-w-0 flex-1 !text-lg">{fr.progress.streak.sessionDone(result.current)}</p>
      <span aria-hidden="true" className="num-l">
        {result.current}
      </span>
      <Link href="/app/progress?from=session" className="lnk min-h-11 content-center">
        {fr.progress.title}
      </Link>
    </section>
  );
}
