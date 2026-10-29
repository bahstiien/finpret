"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Toast = { id: number; text: string; tone: "info" | "error" };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

/** Messages éphémères après une action (« Repas retiré », « Enregistré »…), annoncés aux lecteurs d'écran. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback(
    (text: string, tone: Toast["tone"] = "info") => setToast({ id: Date.now(), text, tone }),
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
            className={`pointer-events-auto max-w-md rounded-card px-4 py-3 text-sm font-semibold shadow-hard ${
              toast.tone === "error" ? "bg-peach text-peach-ink" : "bg-nav text-on-nav"
            }`}
          >
            {toast.text}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
