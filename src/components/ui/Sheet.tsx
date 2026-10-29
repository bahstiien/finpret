"use client";

import { useEffect, useRef } from "react";
import { fr } from "@/i18n/fr";
import { Icon } from "./Icon";

/**
 * Feuille modale (§8.7) sur l'élément natif <dialog> : focus piégé, Échap pour fermer, fond cliquable.
 * En bas de l'écran sur mobile, centrée sur grand écran.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="sheet m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto text-ink backdrop:bg-nav sm:m-auto sm:max-w-lg"
    >
      {open && (
        <>
        <span className="sheet-handle" aria-hidden="true" />
        <div className="flex flex-col gap-4 pt-2 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="t-2">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={fr.common.close}
              className="iconbtn"
            >
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
        </>
      )}
    </dialog>
  );
}
