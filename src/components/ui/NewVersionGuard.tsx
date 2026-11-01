"use client";

import { useEffect, useState } from "react";
import { fr } from "@/i18n/fr";
import { Button } from "./Button";

/** Une Server Action inconnue du serveur : l'onglet tourne sur un build antérieur au dernier déploiement. */
function isStaleAction(reason: unknown) {
  const e = reason as { name?: string; message?: string } | null;
  return e?.name === "UnrecognizedActionError" || /Server Action .* was not found on the server/.test(e?.message ?? "");
}

/** Après un déploiement, propose de recharger l'onglet plutôt que de laisser l'action échouer en silence. */
export function NewVersionGuard() {
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
        <p>{fr.errors.newVersion.text}</p>
        <Button size="sm" variant="dark" onClick={() => window.location.reload()}>
          {fr.errors.newVersion.reload}
        </Button>
      </div>
    </div>
  );
}
