"use client";

import { useCallback, useEffect, useState } from "react";
import { TipCoachmark } from "@/components/ui/Coachmark";
import type { TipKey } from "@/engine/getting-started";
import { fr } from "@/i18n/fr";
import { tipDismissedAction, tipShownAction } from "@/server/actions/getting-started";

const t = fr.gettingStarted.tips;

/**
 * Bulle d'onglet (SPEC_PRISE_EN_MAIN §4.2) : le serveur a décidé de l'afficher (`tipForTab`) ;
 * ici on signale l'affichage, puis la fermeture (« Compris », croix ou Échap) qui mémorise la clé pour ce compte.
 */
export function TipBubble({ tip }: { tip: TipKey }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    void tipShownAction(tip);
  }, [tip]);
  const dismiss = useCallback(() => {
    setOpen(false);
    void tipDismissedAction(tip);
  }, [tip]);
  if (!open) return null;
  return (
    <TipCoachmark
      id={`tip-${tip}`}
      okLabel={t.ok}
      closeLabel={t.close}
      regionLabel={t.region}
      onDismiss={dismiss}
    >
      {t[tip]}
    </TipCoachmark>
  );
}
