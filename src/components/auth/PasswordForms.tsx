"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { type PasswordState, requestPasswordReset, resetPassword } from "@/server/actions/auth";

const t = fr.login;

/** Demande de lien pour changer de mot de passe. */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(requestPasswordReset, {
    status: "idle",
  });

  return (
    <div className="flex flex-col gap-4">
      {state.status === "sent" ? (
        <FormMessage tone="success">{t.forgotSent(state.email)}</FormMessage>
      ) : (
        <form action={action} className="flex flex-col gap-5">
          {state.status === "error" && <FormMessage tone="error">{state.message}</FormMessage>}
          <TextField
            id="forgot-email"
            name="email"
            type="email"
            label={t.email}
            placeholder={t.emailPlaceholder}
            autoComplete="email"
            inputMode="email"
            required
          />
          <Button type="submit" variant="primary" className="btn--block" disabled={pending}>
            {t.forgotSubmit}
          </Button>
        </form>
      )}
      <Link href="/login" className="lnk t-small">
        {t.backToLogin}
      </Link>
    </div>
  );
}

/** Choix du nouveau mot de passe, avec le jeton du lien reçu par e-mail. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(resetPassword, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success">{t.resetDone}</FormMessage>
        <Link href="/login" className="btn btn--primary btn--block">
          {t.submit}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      {state.status === "error" && <FormMessage tone="error">{state.message}</FormMessage>}
      <TextField
        id="reset-password"
        name="password"
        type="password"
        label={t.newPassword}
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        help={t.newPasswordHelp}
        required
      />
      <Button type="submit" variant="primary" className="btn--block" disabled={pending}>
        {t.resetSubmit}
      </Button>
    </form>
  );
}
