"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { applyAssociationCode, type BillingState } from "@/server/actions/billing";

const t = fr.subscription;

export function AssociationCodeForm() {
  const [state, action, pending] = useActionState<BillingState, FormData>(applyAssociationCode, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <TextField
        id="asso-code"
        name="code"
        label={t.codeTitle}
        placeholder={t.codePlaceholder}
        autoCapitalize="characters"
        maxLength={20}
      />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.ok && <FormMessage tone="success">{state.ok}</FormMessage>}
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        {t.codeApply}
      </Button>
    </form>
  );
}
