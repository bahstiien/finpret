"use client";

import { useEffect, useState } from "react";

/** Une Server Action inconnue du serveur : l'onglet tourne sur un build antérieur au dernier déploiement. */
function isStaleAction(reason: unknown) {
  const e = reason as { name?: string; message?: string } | null;
  return e?.name === "UnrecognizedActionError" || /Server Action .* was not found on the server/.test(e?.message ?? "");
}

/**
 * Après un déploiement, propose de recharger l'onglet plutôt que de laisser l'action échouer en silence.
 * Monté par le layout racine sur toutes les pages : les textes arrivent en props et le bouton est en HTML simple,
 * pour ne pas embarquer le dictionnaire `fr` ni les icônes dans le JS commun.
 */
export function NewVersionGuard({ text, reload }: { text: string; reload: string }) {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isStaleAction(event.reason)) return;
      event.preventDefault();
      setStale(true);
    };
    const onError = (event: ErrorEvent) => {
      if (isStaleAction(event.error)) setStale(true);
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  if (!stale) return null;
  return (
    <div
      role="alert"
      data-testid="new-version"
      className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 min-[900px]:bottom-8"
    >
      <div className="toast flex max-w-md items-center gap-3 text-sm font-bold">
        <p>{text}</p>
        <button type="button" className="btn btn--dark btn--sm" onClick={() => window.location.reload()}>
          {reload}
        </button>
      </div>
    </div>
  );
}
