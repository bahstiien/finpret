"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Layout";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { FormMessage, TextField } from "@/components/ui/Field";
import { Checkbox } from "@/components/ui/Extras";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import {
  type LoginState,
  type PasswordState,
  signInWithEmail,
  signInWithPassword,
  signInWithProvider,
  signUpWithPassword,
} from "@/server/actions/auth";

const t = fr.login;

export type AuthMode = "login" | "signup";

const modes: { value: AuthMode; label: string }[] = [
  { value: "login", label: t.modeLogin },
  { value: "signup", label: t.modeSignup },
];

const submitLabel = (label: string) => (
  <>
    {label}
    <Icon name="arrowRight" className="size-5" />
  </>
);

/** Connexion et inscription : onglets Connexion / Inscription, mot de passe, puis lien magique et Google. */
export function LoginForm({
  next,
  initialError,
  initialMode = "login",
}: {
  next: string;
  initialError?: string;
  initialMode?: AuthMode;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  return (
    <div className="flex flex-col gap-6">
      <Segmented block label={t.modesLabel} options={modes} value={mode} onChange={setMode} />
      {mode === "login" ? <PasswordLogin next={next} initialError={initialError} /> : <Signup next={next} />}
      <Alternatives next={next} mode={mode} />
    </div>
  );
}

function PasswordLogin({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(signInWithPassword, { status: "idle" });
  const error =
    state.status === "error"
      ? { title: state.title, message: state.message }
      : state.status === "idle" && initialError
        ? { title: undefined, message: initialError }
        : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="t-2">{t.welcomeBack}</h2>
        <p className="t-small muted">{t.welcomeBackLead}</p>
      </div>
      {error && (
        <Callout tone="error" title={error.title}>
          {error.message}
        </Callout>
      )}
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />
        <TextField
          id="login-email"
          name="email"
          type="email"
          label={t.email}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          inputMode="email"
          defaultValue={state.status === "error" ? state.fields?.email : undefined}
          required
        />
        <TextField
          id="login-password"
          name="password"
          type="password"
          label={t.password}
          autoComplete="current-password"
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Checkbox name="remember" label={t.remember} defaultChecked />
          <Link href="/login/oublie" className="lnk t-small">
            {t.forgot}
          </Link>
        </div>
        <Button type="submit" variant="primary" className="btn--block" disabled={pending}>
          {submitLabel(t.submit)}
        </Button>
      </form>
    </div>
  );
}

function Signup({ next }: { next: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(signUpWithPassword, { status: "idle" });

  if (state.status === "verify") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="t-2">{t.verifyTitle}</h2>
        <FormMessage tone="success">{t.verifySent(state.email)}</FormMessage>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="t-2">{t.createTitle}</h2>
        <p className="t-small muted">{t.createLead}</p>
      </div>
      {state.status === "error" && <FormMessage tone="error">{state.message}</FormMessage>}
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next === "/app" ? "/onboarding" : next} />
        <TextField
          id="signup-name"
          name="name"
          label={t.firstName}
          autoComplete="given-name"
          maxLength={60}
          defaultValue={state.status === "error" ? state.fields?.name : undefined}
          required
        />
        <TextField
          id="signup-email"
          name="email"
          type="email"
          label={t.email}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          inputMode="email"
          defaultValue={state.status === "error" ? state.fields?.email : undefined}
          required
        />
        <TextField
          id="signup-password"
          name="password"
          type="password"
          label={t.newPassword}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          help={t.newPasswordHelp}
          required
        />
        <TextField
          id="signup-code"
          name="code"
          label={t.assoCode}
          mono
          placeholder={t.assoCodePlaceholder}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={20}
          help={t.assoCodeHelp}
          helpIcon="users"
        />
        <Checkbox name="news" label={t.news} defaultChecked />
        <Button type="submit" variant="primary" className="btn--block" disabled={pending}>
          {submitLabel(t.create)}
        </Button>
        <p className="t-small muted">
          {t.termsPrefix}
          <Link href="/cgu" className="lnk">
            {t.terms}
          </Link>
          {t.termsAnd}
          <Link href="/confidentialite" className="lnk">
            {t.privacy}
          </Link>
          .
        </p>
      </form>
    </div>
  );
}

/** Google (et Apple, reporté) pour les deux onglets ; le lien magique reste proposé à la connexion. */
function Alternatives({ next, mode }: { next: string; mode: AuthMode }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithEmail, { status: "idle" });

  return (
    <div className="flex flex-col gap-4">
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

      {mode === "login" &&
        (state.status === "sent" ? (
          <FormMessage tone="success">{t.sent(state.email)}</FormMessage>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next} />
            <TextField
              id="magic-email"
              name="email"
              type="email"
              label={t.magicEmail}
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              inputMode="email"
              required
            />
            {state.status === "error" && <FormMessage tone="error">{state.message}</FormMessage>}
            <Button type="submit" variant="secondary" className="btn--block" disabled={pending}>
              {t.magicSubmit}
            </Button>
          </form>
        ))}
    </div>
  );
}
