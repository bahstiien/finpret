"use client";

import { useCallback, useEffect } from "react";
import { TipCoachmark } from "@/components/ui/Coachmark";
import type { FirstSessionTip } from "@/engine/getting-started";
import { fr } from "@/i18n/fr";
import { tipDismissedAction, tipShownAction } from "@/server/actions/getting-started";

const t = fr.gettingStarted;

/**
 * Conseil de première session (SPEC_PRISE_EN_MAIN §4.4.4) : même bulle que les onglets, hors limite des 2 par jour.
 * Le parent choisit lequel afficher (un à la fois) et le retire à la fermeture.
 */
export function SessionTip({ tip, onDone }: { tip: FirstSessionTip; onDone: () => void }) {
  useEffect(() => {
    void tipShownAction(tip);
  }, [tip]);
  const dismiss = useCallback(() => {
    onDone();
    void tipDismissedAction(tip);
  }, [tip, onDone]);
  return (
    <TipCoachmark
      id={`tip-${tip}`}
      okLabel={t.tips.ok}
      closeLabel={t.tips.close}
      regionLabel={t.tips.region}
      onDismiss={dismiss}
    >
      {t.firstSession.tips[tip]}
    </TipCoachmark>
  );
}
