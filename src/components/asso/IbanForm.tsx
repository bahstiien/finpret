"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { saveIbanAction, type SimpleState } from "@/server/actions/asso";

const t = fr.asso.statements;

/** Saisie de l'IBAN : chiffré côté serveur, seuls les 4 derniers caractères restent affichés. */
export function IbanForm({ last4 }: { last4: string | null }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(saveIbanAction, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <p className="font-semibold">{last4 ? `${t.iban} : •••• ${last4}` : t.ibanMissing}</p>
      <TextField
        id="iban"
        name="iban"
        label={t.ibanLabel}
        autoComplete="off"
        spellCheck={false}
        placeholder="FR76 …"
        required
      />
      <p className="text-sm text-muted">{t.ibanHint}</p>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.ok && <FormMessage tone="success">{state.ok}</FormMessage>}
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        {t.ibanSave}
      </Button>
    </form>
  );
}
