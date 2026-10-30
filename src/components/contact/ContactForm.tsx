"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Callout } from "@/components/ui/Layout";
import { Segmented } from "@/components/ui/Segmented";
import { FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { sendContact, type ContactState } from "@/server/actions/contact";
import { fr } from "@/i18n/fr";
import type { ContactAudience } from "@/lib/contact";

const t = fr.contact;

const audiences: { value: ContactAudience; label: string }[] = [
  { value: "famille", label: t.family },
  { value: "asso", label: t.asso },
];

/** Formulaire de contact (Famille ou Association) ; une fois le message parti, l'écran de confirmation prend la place. */
export function ContactForm() {
  // Changer la clé remonte le formulaire : « Écrire un autre message » repart d'une page vide.
  const [round, setRound] = useState(0);
  return <ContactFormRound key={round} onAgain={() => setRound((n) => n + 1)} />;
}

function ContactFormRound({ onAgain }: { onAgain: () => void }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, { status: "idle" });
  const [who, setWho] = useState<ContactAudience>("famille");
  const isAsso = who === "asso";

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-6">
        <Card tone="green">
          <div role="status" className="flex flex-col items-start gap-4">
            <span className="nb-sm grid size-14 place-items-center bg-surface text-ink" aria-hidden="true">
              <Icon name="check" className="ic-lg" />
            </span>
            <h2 className="t-2">{t.sentTitle}</h2>
            <p className="t-body">{t.sentText}</p>
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="btn btn--primary">
            {t.home}
            <Icon name="arrowRight" className="size-5" />
          </Link>
          <Button type="button" variant="ghost" onClick={onAgain}>
            {t.another}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="audience" value={who} />
        <Segmented block label={t.whoLabel} options={audiences} value={who} onChange={setWho} />

        {isAsso && (
          <Callout tone="info" icon="users" title={t.assoCalloutTitle}>
            {t.assoCallout}
          </Callout>
        )}

        <div className="grid gap-5 min-[560px]:grid-cols-2">
          <TextField
            id="contact-name"
            name="name"
            label={t.firstName}
            autoComplete="given-name"
            maxLength={60}
            required
          />
          <TextField
            id="contact-email"
            name="email"
            type="email"
            label={t.email}
            placeholder={t.emailPlaceholder}
            autoComplete="email"
            inputMode="email"
            required
          />
        </div>

        {isAsso && (
          <div className="grid gap-5 min-[560px]:grid-cols-2">
            <TextField
              id="contact-asso"
              name="association"
              label={t.assoName}
              autoComplete="organization"
              maxLength={120}
            />
            <TextField
              id="contact-school"
              name="school"
              label={t.school}
              placeholder={t.schoolPlaceholder}
              maxLength={160}
            />
          </div>
        )}

        {/* La clé remet le sujet à zéro quand le public change : la liste n'est plus la même. */}
        <SelectField key={who} id="contact-subject" name="subject" label={t.subject} defaultValue="" required>
          <option value="" disabled>
            {t.subjectPlaceholder}
          </option>
          {t.subjects[who].map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </SelectField>

        <TextArea
          id="contact-message"
          name="message"
          label={t.message}
          rows={6}
          minLength={10}
          maxLength={2000}
          help={t.messageHelp[who]}
          required
        />

        {/* Champ piège : invisible pour une personne, rempli par un robot. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

        <p className="t-small muted">
          {t.privacyPrefix}
          <Link href="/confidentialite" className="lnk">
            {t.privacy}
          </Link>
        </p>

        {state.status === "error" && <FormMessage tone="error">{state.message}</FormMessage>}

        <Button type="submit" variant="primary" className="btn--block" disabled={pending}>
          {t.submit}
          <Icon name="arrowRight" className="size-5" />
        </Button>
      </form>
    </Card>
  );
}
