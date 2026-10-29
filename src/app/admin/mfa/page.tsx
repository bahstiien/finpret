import { redirect } from "next/navigation";
import { MfaPanel } from "@/components/admin/MfaPanel";
import { requireAdminIdentity } from "@/server/admin";
import { startMfaEnrollment } from "@/server/mfa";
import { PageHeader } from "@/components/ui/Layout";

/** Activation et saisie du second facteur : l'accès au back-office exige une session validée par TOTP. */
export default async function MfaPage() {
  const { user, mfaVerified } = await requireAdminIdentity();
  if (mfaVerified) redirect("/admin");
  return (
    <>
      <PageHeader title="Second facteur requis" />
      <MfaPanel enrollment={await startMfaEnrollment(user)} />
    </>
  );
}
