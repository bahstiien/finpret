"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; text: string; tone: "info" | "error"; action?: ToastAction };
const ToastContext = createContext<(text: string, tone?: Toast["tone"], action?: ToastAction) => void>(() => {});

/** Messages éphémères après une action (« Repas retiré », « Enregistré »…), annoncés aux lecteurs d'écran. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback(
    (text: string, tone: Toast["tone"] = "info", action?: ToastAction) =>
      setToast({ id: Date.now(), text, tone, action }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 min-[900px]:bottom-8"
      >
        {toast && (
          <p
            key={toast.id}
            data-testid="toast"
            role={toast.tone === "error" ? "alert" : "status"}
            className={`toast pointer-events-auto max-w-md text-sm font-bold ${toast.tone === "error" ? "!bg-pink !text-[var(--on-fill)]" : ""}`}
          >
            {toast.text}
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                className="lnk ml-3 min-h-11 px-1"
              >
                {toast.action.label}
              </button>
            )}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
