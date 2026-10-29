"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { inviteEditorAction, type SimpleState } from "@/server/actions/asso";

const t = fr.asso.team;

export function InviteEditorForm() {
  const [state, action, pending] = useActionState<SimpleState, FormData>(inviteEditorAction, {});
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <TextField id="invite-email" name="email" type="email" label={t.email} required autoComplete="off" />
        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        <Button type="submit" disabled={pending}>
          {t.create}
        </Button>
      </form>
      {state.link && (
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-link" className="text-sm font-semibold">
            {t.link}
          </label>
          <input
            id="invite-link"
            readOnly
            value={state.link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-full rounded-card bg-bg px-3 text-sm"
          />
        </div>
      )}
    </div>
  );
}
