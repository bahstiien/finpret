import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginHero, MobileFooter } from "@/components/auth/LoginHero";
import { Card } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";
import { safeNext } from "@/lib/redirect";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: fr.login.title };

// `provider` : fournisseur indisponible ; tout autre code (Better Auth : INVALID_TOKEN, EXPIRED_TOKEN…) vient du lien.
const errorMessage = (code: string) =>
  code === "provider" ? fr.login.providerUnavailable : fr.login.linkExpired;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getUser()) redirect(next);

  return (
    <AuthShell aside={fr.login.helpLead} asideHref="/contact" asideLabel={fr.login.helpLink}>
      <div className="flex flex-col gap-6 min-[1000px]:flex-row min-[1000px]:items-start min-[1000px]:gap-12">
        <LoginHero />
        <section aria-label={fr.login.title} className="w-full min-w-0 min-[1000px]:flex-[0_1_460px]">
          <Card className="flex flex-col gap-6">
            <LoginForm
              next={next}
              initialMode={params.mode === "inscription" ? "signup" : "login"}
              initialError={params.error ? errorMessage(params.error) : undefined}
            />
          </Card>
        </section>
        <MobileFooter />
      </div>
    </AuthShell>
  );
}
