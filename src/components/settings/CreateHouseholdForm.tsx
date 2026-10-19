"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { createHousehold, type FormState } from "@/server/actions/households";

export function CreateHouseholdForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createHousehold, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        id="name"
        name="name"
        label={fr.household.nameLabel}
        placeholder={fr.household.namePlaceholder}
        maxLength={60}
        required
      />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Button type="submit" disabled={pending}>
        {fr.household.create}
      </Button>
    </form>
  );
}
