"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Layout";
import { fr } from "@/i18n/fr";
import { prepareWeekAction } from "@/server/actions/menu";
import { useMenuAction } from "./useMenuAction";

/** Aucune semaine prévue : proposer d'en préparer une. */
export function NoWeek({
  header,
  canEdit,
  start,
}: {
  header: { date: string; greeting: string; name: string };
  canEdit: boolean;
  start: string;
}) {
  const { run, pending } = useMenuAction();
  return (
    <>
      <PageHeader
        eyebrow={header.date}
        title={
          <>
            {header.greeting}, {header.name}
          </>
        }
      />
      <EmptyState
        icon="sparkle"
        title={fr.gettingStarted.empty.menuNoWeek.title}
        action={
          canEdit ? (
            <Button type="button" disabled={pending} onClick={() => run(() => prepareWeekAction(start))}>
              {fr.gettingStarted.empty.menuNoWeek.action}
            </Button>
          ) : undefined
        }
      >
        {fr.gettingStarted.empty.menuNoWeek.text}
      </EmptyState>
    </>
  );
}
