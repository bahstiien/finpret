"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { type SavedState, saveHouseholdName, saveProfileName } from "@/server/actions/profile";

const t = fr.settingsAccount;

export function ProfileNameForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<SavedState, FormData>(saveProfileName, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        id="displayName"
        name="displayName"
        label={t.displayName}
        defaultValue={initial}
        maxLength={60}
        required
      />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.saved && <FormMessage tone="success">{t.saved}</FormMessage>}
      <Button type="submit" disabled={pending} className="self-start">
        {t.save}
      </Button>
    </form>
  );
}

export function HouseholdNameForm({ householdId, initial }: { householdId: string; initial: string }) {
  const [state, action, pending] = useActionState<SavedState, FormData>(saveHouseholdName, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="householdId" value={householdId} />
      <TextField
        id="name"
        name="name"
        label={t.householdName}
        defaultValue={initial}
        maxLength={60}
        required
      />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.saved && <FormMessage tone="success">{t.saved}</FormMessage>}
      <Button type="submit" disabled={pending} className="self-start">
        {t.save}
      </Button>
    </form>
  );
}
