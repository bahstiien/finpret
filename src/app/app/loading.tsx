import { fr } from "@/i18n/fr";

/** Squelette instantané pendant le chargement d'un onglet : la navigation répond tout de suite. */
export default function Loading() {
  return (
    <div role="status" aria-label={fr.common.loading} className="flex flex-col gap-5">
      <div className="skeleton h-12 w-2/3 max-w-md" />
      <div className="skeleton h-40" />
      <div className="grid gap-5 min-[900px]:grid-cols-2">
        <div className="skeleton h-56" />
        <div className="skeleton h-56" />
      </div>
    </div>
  );
}
