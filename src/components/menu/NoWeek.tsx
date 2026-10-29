"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
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
      <Card tone="peach" className="flex flex-col gap-4">
        <p className="t-ui">{fr.menu.noWeek}</p>
        {canEdit && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => prepareWeekAction(start))}
            className="self-start"
          >
            {fr.menu.prepare}
          </Button>
        )}
      </Card>
    </>
  );
}
