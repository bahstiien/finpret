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
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-sheet border-[length:var(--bw)] border-line bg-surface p-0 text-ink backdrop:bg-nav sm:m-auto sm:max-w-lg sm:rounded-sheet"
    >
      {open && (
        <div className="flex flex-col gap-4 p-4 pb-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={fr.common.close}
              className="grid size-11 place-items-center rounded-r2 border-[length:var(--bw)] border-line bg-chip"
            >
              <Icon name="close" className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
