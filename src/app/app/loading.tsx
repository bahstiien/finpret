import { Skeleton } from "@/components/ui/Layout";
import { fr } from "@/i18n/fr";

/** Squelette instantané pendant le chargement d'un onglet : la navigation répond tout de suite. */
export default function Loading() {
  return (
    <div role="status" aria-label={fr.common.loading} className="flex flex-col gap-4">
      <Skeleton className="h-12 w-2/3 max-w-md" />
      <Skeleton className="h-40" />
      <div className="grid gap-4 min-[900px]:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
