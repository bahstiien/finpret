"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const supabase = useMemo(() => createClient(), []);
  const [row, setRow] = useState<SessionRow | null>(initial);
  // Écritures locales en cours : les états reçus entre-temps sont plus anciens que l'état optimiste.
  const writes = useRef(0);

  useEffect(() => setRow(initial), [initial]);

  const reload = useCallback(async () => {
    if (!weekId) return;
    const { data } = await supabase
      .from("sessions")
      .select("week_id, started_at, current_step, tasks_done, timers")
      .eq("week_id", weekId)
      .maybeSingle();
    if (data && writes.current === 0) setRow(data as unknown as SessionRow);
  }, [supabase, weekId]);

  useEffect(() => {
    if (!weekId) return;
    let cancelled = false;
    const channel = supabase.channel(`session:${weekId}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sessions", filter: `household_id=eq.${householdId}` },
      (payload) => {
        const next = payload.new as SessionRow;
        if (next?.week_id === weekId && writes.current === 0) setRow(next);
      },
    );
    // La session est lue dans les cookies de façon asynchrone : l'abonnement attend le jeton (RLS).
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) void supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") void reload();
      });
    });
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [supabase, weekId, householdId, reload]);

  const call = useCallback(
    async (fn: () => PromiseLike<{ error: unknown }>) => {
      writes.current++;
      try {
        await fn();
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
    start: () => call(() => supabase.rpc("session_start", { p_week: weekId! })),
    setStep: (step) => {
      setRow((r) => (r ? { ...r, current_step: step } : r));
      return call(() => supabase.rpc("session_set_step", { p_week: weekId!, p_step: step }));
    },
    setTask: (key, done) => {
      setRow((r) => {
        if (!r) return r;
        const d = { ...(r.tasks_done.done ?? {}) };
        if (done) d[key] = true;
        else delete d[key];
        return { ...r, tasks_done: { ...r.tasks_done, done: d } };
      });
      return call(() => supabase.rpc("session_set_task", { p_week: weekId!, p_key: key, p_done: done }));
    },
    startTimer: (label, minutes, step) =>
      call(() =>
        supabase.rpc("session_start_timer", {
          p_week: weekId!,
          p_id: crypto.randomUUID(),
          p_label: label,
          p_minutes: minutes,
          p_step: step,
        }),
      ),
    timerAction: (id, action) =>
      call(() => supabase.rpc("session_timer", { p_week: weekId!, p_id: id, p_action: action })),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
