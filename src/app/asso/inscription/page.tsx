import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/asso/SignupForm";
import { fr } from "@/i18n/fr";
import { getMyAssociation } from "@/server/asso-session";
import { requireUser } from "@/server/session";

const t = fr.asso.signup;

export const metadata: Metadata = { title: t.title };

/** Création du compte d'une association (statut « en attente » jusqu'à la validation). */
export default async function SignupPage() {
  await requireUser("/asso/inscription");
  if (await getMyAssociation()) redirect("/asso");
  return (
    <>
      <h1 className="text-4xl font-black">{t.title}</h1>
      <p className="text-muted">{t.lead}</p>
      <div className="rounded-card bg-surface p-5">
        <SignupForm />
      </div>
    </>
  );
}
