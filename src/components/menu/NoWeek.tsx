"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
      <header>
        <p className="text-sm font-semibold text-muted first-letter:uppercase">{header.date}</p>
        <h1 className="text-4xl font-bold [overflow-wrap:anywhere]">
          {header.greeting}, {header.name}
        </h1>
      </header>
      <Card className="flex flex-col gap-4">
        <p className="text-muted">{fr.menu.noWeek}</p>
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
