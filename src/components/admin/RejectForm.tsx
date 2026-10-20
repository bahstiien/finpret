"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { rejectAssociation } from "@/server/actions/admin";

/** Refus d'une association : le motif est obligatoire et part dans l'e-mail au bureau. */
export function RejectForm({ id }: { id: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await rejectAssociation(fd);
          setError(res.ok ? undefined : res.error);
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Motif du refus
        <input
          name="reason"
          required
          minLength={3}
          maxLength={300}
          className="min-h-11 rounded-2xl border-2 border-line bg-surface px-3"
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        Refuser
      </Button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </form>
  );
}
