"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { createAssociationAction, type SignupState } from "@/server/actions/asso";

const t = fr.asso.signup;

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(createAssociationAction, {});
  const [schools, setSchools] = useState(1);
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        id="name"
        name="name"
        label={t.name}
        placeholder={t.namePlaceholder}
        required
        maxLength={120}
      />
      <TextField id="rna" name="rna" label={t.rna} required inputMode="text" autoComplete="off" />
      <p className="t-small muted -mt-2">{t.rnaHint}</p>
      <TextField id="email" name="email" type="email" label={t.email} required autoComplete="email" />
      <TextField id="manager" name="manager" label={t.manager} required maxLength={80} autoComplete="name" />
      <fieldset className="flex flex-col gap-3">
        <legend className="t-label mb-2">{t.schools}</legend>
        {Array.from({ length: schools }, (_, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-r1 border-[length:var(--bw)] border-line bg-bg p-3">
            <TextField
              id={`school-${i}-name`}
              name={`school-${i}-name`}
              label={t.schoolName}
              className="min-w-48 flex-1"
              required={i === 0}
            />
            <TextField
              id={`school-${i}-city`}
              name={`school-${i}-city`}
              label={t.schoolCity}
              className="min-w-40 flex-1"
              required={i === 0}
            />
            <TextField
              id={`school-${i}-uai`}
              name={`school-${i}-uai`}
              label={t.schoolUai}
              className="w-40"
              maxLength={8}
            />
          </div>
        ))}
        {schools < 10 && (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => setSchools(schools + 1)}
          >
            {t.addSchool}
          </Button>
        )}
      </fieldset>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Button type="submit" disabled={pending}>
        {t.submit}
      </Button>
    </form>
  );
}
