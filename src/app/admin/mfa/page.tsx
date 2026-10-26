import { redirect } from "next/navigation";
import { MfaPanel } from "@/components/admin/MfaPanel";
import { requireAdminIdentity } from "@/server/admin";
import { PageHeader } from "@/components/ui/Layout";

/** Activation et saisie du second facteur : l'accès au back-office exige le niveau aal2. */
export default async function MfaPage() {
  const { supabase } = await requireAdminIdentity();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") redirect("/admin");
  return (
    <>
      <PageHeader title="Second facteur requis" />
      <MfaPanel />
    </>
  );
}
