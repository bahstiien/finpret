"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { associationsFr } from "@/i18n/associations";
import { type LeadState, submitLead } from "@/server/actions/public";

const t = associationsFr.lead;

/** Demande de présentation par e-mail. Le champ « website » est un piège à robots : invisible, jamais rempli par un humain. */
export function LeadForm() {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead, {});
  if (state.ok) return <FormMessage tone="success">{t.sent}</FormMessage>;
  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-surface p-6" id="presentation">
      <h2 className="text-2xl font-bold">{t.title}</h2>
      <p className="text-muted">{t.intro}</p>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Ne pas remplir
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <TextField id="lead-name" name="name" label={t.name} required autoComplete="name" maxLength={120} />
      <TextField id="lead-email" name="email" type="email" label={t.email} required autoComplete="email" />
      <TextField id="lead-asso" name="association" label={t.association} required maxLength={160} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="lead-school" name="school" label={t.school} maxLength={160} />
        <TextField id="lead-city" name="city" label={t.city} maxLength={80} />
      </div>
      <TextField
        id="lead-families"
        name="families"
        type="number"
        min={0}
        max={100000}
        inputMode="numeric"
        label={t.families}
      />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 size-5 accent-violet" />
        <span>{t.consent}</span>
      </label>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Button type="submit" disabled={pending} className="self-start">
        {t.submit}
      </Button>
    </form>
  );
}
