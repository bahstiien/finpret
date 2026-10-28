import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { CenteredPage, Logo } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";
import { safeNext } from "@/lib/redirect";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: fr.login.title };

const errors: Record<string, string> = {
  link: fr.login.linkExpired,
  provider: fr.login.providerUnavailable,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getUser()) redirect(next);

  return (
    <CenteredPage>
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{fr.login.title}</h1>
        <p className="text-muted">{fr.login.lead}</p>
      </div>
      <LoginForm next={next} initialError={params.error ? errors[params.error] : undefined} />
    </CenteredPage>
  );
}
