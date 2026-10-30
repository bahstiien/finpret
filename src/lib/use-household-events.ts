"use client";

import { useEffect, useRef } from "react";

/** Changement signalé par /api/realtime : la table modifiée et sa semaine (sans les données). */
export type HouseholdChange = { table: string; weekId: string | null };

/**
 * Écoute les changements d'un foyer (flux SSE de /api/realtime). `onReady` est appelé à chaque (re)connexion :
 * des changements ont pu être manqués pendant la coupure, il faut relire. EventSource se reconnecte seul.
 */
export function useHouseholdEvents(
  householdId: string | null,
  onChange: (change: HouseholdChange) => void,
  onReady?: () => void,
) {
  const handlers = useRef({ onChange, onReady });
  useEffect(() => {
    handlers.current = { onChange, onReady };
  });

  useEffect(() => {
    if (!householdId) return;
    const source = new EventSource(`/api/realtime?household=${encodeURIComponent(householdId)}`);
    source.addEventListener("ready", () => handlers.current.onReady?.());
    source.onmessage = (message) => {
      try {
        handlers.current.onChange(JSON.parse(message.data) as HouseholdChange);
      } catch {
        // Message illisible : ignoré, la prochaine relecture rattrapera.
      }
    };
    return () => source.close();
  }, [householdId]);
}
