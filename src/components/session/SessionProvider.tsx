"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { FEATURES } from "@/lib/features";
import { useHouseholdEvents } from "@/lib/use-household-events";
import { recordWeekEvent } from "@/server/actions/events";
import { readSessionRow, runSessionCommand, type SessionCommand } from "@/server/actions/session-sync";

/** État partagé de la session (§8.5) : étape, tâches cochées, minuteurs, synchronisés entre appareils. */

export type Timer = {
  id: string;
  label: string;
  minutes: number;
  step: number;
  endsAt: string;
  doneAt?: string;
};
export type SessionRow = {
  week_id: string;
  started_at: string | null;
  current_step: number;
  tasks_done: { sig?: string; done?: Record<string, boolean> };
  timers: Timer[];
  updated_at?: string;
};

type Ctx = {
  row: SessionRow | null;
  canEdit: boolean;
  sound: boolean;
  vibration: boolean;
  start: () => Promise<void>;
  setStep: (step: number) => Promise<void>;
  setTask: (key: string, done: boolean) => Promise<void>;
  startTimer: (label: string, minutes: number, step: number) => Promise<void>;
  timerAction: (id: string, action: "snooze" | "done") => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);
export const useSession = () => useContext(SessionContext);

export function SessionProvider({
  householdId,
  weekId,
  initial,
  canEdit,
  sound,
  vibration,
  children,
}: {
  householdId: string;
  /** Semaine de la session (préparée, sinon en cours), même si son état n'existe pas encore. */
  weekId: string | null;
  initial: SessionRow | null;
  canEdit: boolean;
  sound: boolean;
  vibration: boolean;
  children: React.ReactNode;
}) {
  const [row, setRow] = useState<SessionRow | null>(initial);
  // Écritures locales en cours : les états reçus entre-temps sont plus anciens que l'état optimiste.
  const writes = useRef(0);
  // N'applique un état relu que s'il est au moins aussi récent que l'état connu (les relectures peuvent se croiser).
  const accept = useCallback((next: SessionRow) => {
    setRow((cur) => (!cur?.updated_at || !next.updated_at || next.updated_at >= cur.updated_at ? next : cur));
  }, []);

  useEffect(() => setRow(initial), [initial]);

  const reload = useCallback(async () => {
    if (!weekId) return;
    const data = await readSessionRow(weekId).catch(() => null);
    if (data && writes.current === 0) accept(data);
  }, [weekId, accept]);

  useEffect(() => {
    if (!weekId) return;
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [weekId, reload]);

  // La synchronisation en direct entre appareils est REPORTÉE (SPEC_JANVIER) : sans elle, l'état reste relu au retour
  // sur l'onglet.
  useHouseholdEvents(
    FEATURES.sharedSession && weekId ? householdId : null,
    (change) => {
      if (change.table === "sessions" && change.weekId === weekId && writes.current === 0) void reload();
    },
    () => void reload(),
  );

  const call = useCallback(
    async (command: SessionCommand) => {
      writes.current++;
      try {
        // Une écriture refusée ou perdue est rattrapée par la relecture qui suit.
        await runSessionCommand(command).catch(() => {});
      } finally {
        writes.current--;
      }
      // Une seule relecture, une fois toutes les écritures terminées.
      if (writes.current === 0) await reload();
    },
    [reload],
  );

  const value: Ctx = {
    row,
    canEdit,
    sound,
    vibration,
    start: async () => {
      await call({ fn: "session_start", args: { p_week: weekId! } });
      void recordWeekEvent("session_started", weekId!);
    },
    setStep: (step) => {
      setRow((r) => (r ? { ...r, current_step: step } : r));
      return call({ fn: "session_set_step", args: { p_week: weekId!, p_step: step } });
    },
    setTask: (key, done) => {
      setRow((r) => {
        if (!r) return r;
        const d = { ...(r.tasks_done.done ?? {}) };
        if (done) d[key] = true;
        else delete d[key];
        return { ...r, tasks_done: { ...r.tasks_done, done: d } };
      });
      return call({ fn: "session_set_task", args: { p_week: weekId!, p_key: key, p_done: done } });
    },
    startTimer: (label, minutes, step) =>
      call({
        fn: "session_start_timer",
        args: {
          p_week: weekId!,
          p_id: crypto.randomUUID(),
          p_label: label,
          p_minutes: minutes,
          p_step: step,
        },
      }),
    timerAction: (id, action) =>
      call({ fn: "session_timer", args: { p_week: weekId!, p_id: id, p_action: action } }),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
