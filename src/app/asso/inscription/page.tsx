import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/asso/SignupForm";
import { fr } from "@/i18n/fr";
import { getMyAssociation } from "@/server/asso-session";
import { requireUser } from "@/server/session";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

const t = fr.asso.signup;

export const metadata: Metadata = { title: t.title };

/** Création du compte d'une association (statut « en attente » jusqu'à la validation). */
export default async function SignupPage() {
  await requireUser("/asso/inscription");
  if (await getMyAssociation()) redirect("/asso");
  return (
    <>
      <PageHeader title={t.title} />
      <p className="text-muted">{t.lead}</p>
      <Card as="div" padding="cozy">
        <SignupForm />
      </Card>
    </>
  );
}
