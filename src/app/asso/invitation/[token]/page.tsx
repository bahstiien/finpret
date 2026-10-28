import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CenteredPage } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { acceptEditorInvitation } from "@/server/actions/asso";
import { getUser } from "@/server/session";
import { buttonClass } from "@/components/ui/Button";

const t = fr.asso.team.accept;

export const metadata: Metadata = { title: "Invitation", robots: { index: false, follow: false } };

/** Invitation d'un éditeur de menus : aperçu public, puis acceptation après connexion. */
export default async function EditorInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_association_invitation", { p_token: token });
  const invitation = data?.[0];
  const user = await getUser();
  const problem = !invitation
    ? t.notFound
    : invitation.status === "used"
      ? t.used
      : invitation.status === "expired"
        ? t.expired
        : error === "too_many_editors"
          ? t.too_many_editors
          : null;
  return (
    <CenteredPage>
      {problem || !invitation ? (
        <FormMessage tone="error">{problem}</FormMessage>
      ) : (
        <>
          <h1 className="text-3xl font-bold">{t.title(invitation.association_name)}</h1>
          <p className="text-muted">{t.lead}</p>
          {user ? (
            <form action={acceptEditorInvitation}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full">
                {t.cta}
              </Button>
            </form>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/asso/invitation/${token}`)}`}
              className={buttonClass()}
            >
              {t.login}
            </Link>
          )}
        </>
      )}
    </CenteredPage>
  );
}
