"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { type LoginState, signInWithEmail, signInWithProvider } from "@/server/actions/auth";

const t = fr.login;

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithEmail, { status: "idle" });
  const error = state.status === "error" ? state.message : state.status === "idle" ? initialError : undefined;

  return (
    <div className="flex flex-col gap-4">
      {state.status === "sent" ? (
        <FormMessage tone="success">{t.sent(state.email)}</FormMessage>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <TextField
            id="email"
            name="email"
            type="email"
            label={t.email}
            placeholder={t.emailPlaceholder}
            autoComplete="email"
            inputMode="email"
            required
          />
          <Button type="submit" variant="primary" disabled={pending}>
            {t.submit}
          </Button>
        </form>
      )}

      {error && <FormMessage tone="error">{error}</FormMessage>}

      <div className="t-kicker flex items-center gap-3" aria-hidden="true">
        <span className="h-[var(--bw)] flex-1 bg-line" />
        {t.or}
        <span className="h-[var(--bw)] flex-1 bg-line" />
      </div>

      {(FEATURES.appleSignIn ? (["apple", "google"] as const) : (["google"] as const)).map((provider) => (
        <form key={provider} action={signInWithProvider}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" className="btn--block">
            {t[provider]}
          </Button>
        </form>
      ))}
    </div>
  );
}
