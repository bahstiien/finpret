import type { Metadata } from "next";
import Link from "next/link";
import { CenteredPage, Logo } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";
import { ActionForm } from "@/components/ui/ActionForm";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation } from "@/server/actions/households";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation", { p_token: token });
  const invitation = data?.[0];
  const user = await getUser();

  return (
    <CenteredPage>
      <Logo />
      {!invitation ? (
        <FormMessage tone="error">{fr.join.notFound}</FormMessage>
      ) : invitation.status !== "valid" ? (
        <FormMessage tone="error">{fr.join[invitation.status]}</FormMessage>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black">{fr.join.title(invitation.household_name)}</h1>
            <p className="text-muted">{fr.join.lead(fr.roles[invitation.role])}</p>
          </div>
          {user ? (
            <ActionForm
              action={acceptInvitation.bind(null, token)}
              fields={{}}
              label={fr.join.accept}
              variant="primary"
            />
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-pill bg-banana px-6 font-bold text-[#17151F]"
            >
              {fr.join.loginFirst}
            </Link>
          )}
        </>
      )}
    </CenteredPage>
  );
}
