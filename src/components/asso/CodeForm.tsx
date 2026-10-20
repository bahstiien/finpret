"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { type SimpleState, updateCodeAction } from "@/server/actions/asso";

const t = fr.asso.dashboard;

/** Modification du code, une seule fois (SPEC_JANVIER §5). */
export function CodeForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(updateCodeAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <TextField
        id="code"
        name="code"
        label={t.codeChange}
        defaultValue={code}
        maxLength={20}
        autoCapitalize="characters"
      />
      <p className="text-sm text-muted">{t.codeChangeHint}</p>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.ok && <FormMessage tone="success">{state.ok}</FormMessage>}
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        {t.codeSave}
      </Button>
    </form>
  );
}
