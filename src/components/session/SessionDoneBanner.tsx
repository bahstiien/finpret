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
    <p
      className="flex flex-wrap items-center gap-2 rounded-card bg-violet-soft p-4 font-bold text-violet-strong"
      data-testid="session-streak"
    >
      <Icon name="streak" />
      {fr.progress.streak.sessionDone(result.current)}
      <Link href="/app/progress?from=session" className="ml-auto min-h-11 content-center underline">
        {fr.progress.title}
      </Link>
    </p>
  );
}
