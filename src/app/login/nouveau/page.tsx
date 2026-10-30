import type { Metadata } from "next";
import Link from "next/link";
import { AuthSimplePage } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: fr.login.resetTitle };

/** Better Auth revient ici avec `?token=…` ; un lien expiré ou déjà servi revient avec `?error=INVALID_TOKEN`. */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <AuthSimplePage title={fr.login.resetTitle} lead={fr.login.resetLead}>
      <Card className="flex flex-col gap-4">
        {token && !error ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <FormMessage tone="error">{fr.login.resetInvalid}</FormMessage>
            <Link href="/login/oublie" className="btn btn--primary btn--block">
              {fr.login.forgotSubmit}
            </Link>
          </>
        )}
      </Card>
    </AuthSimplePage>
  );
}
