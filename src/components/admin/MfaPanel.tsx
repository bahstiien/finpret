"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage, TextField } from "@/components/ui/Field";
import { type MfaState, submitMfaCode } from "@/server/actions/mfa";
import type { MfaEnrollment } from "@/server/mfa";

/** Second facteur TOTP : activation au premier passage (QR code), puis saisie du code à chaque session. */
export function MfaPanel({ enrollment }: { enrollment: MfaEnrollment }) {
  const [state, action, pending] = useActionState<MfaState, FormData>(submitMfaCode, {});

  return (
    <Card as="div" className="flex max-w-md flex-col gap-4">
      {enrollment.enrolled ? (
        <p>Saisissez le code à 6 chiffres de votre application d&apos;authentification.</p>
      ) : (
        <>
          <p>
            Scannez ce QR code avec votre application d&apos;authentification, puis saisissez le code à 6
            chiffres.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR code généré côté serveur (data URL) */}
          <img src={enrollment.qr} alt="QR code du second facteur" width={180} height={180} />
          <p className="text-sm text-muted">
            Ou saisissez la clé : <code>{enrollment.secret}</code>
          </p>
        </>
      )}
      <form action={action} className="flex flex-col gap-4">
        <TextField
          id="totp"
          name="code"
          label="Code à 6 chiffres"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
        />
        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        <Button type="submit" disabled={pending}>
          Valider
        </Button>
      </form>
    </Card>
  );
}
