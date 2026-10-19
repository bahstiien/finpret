import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateHouseholdForm } from "@/components/settings/CreateHouseholdForm";
import { Card, CenteredPage, Logo } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";
import { getHouseholds, requireUser } from "@/server/session";

export const metadata: Metadata = { title: fr.household.createTitle };

// M1 : seule l'étape « Foyer » existe ; l'assistant complet en 5 étapes arrive en M4 (§5).
export default async function OnboardingPage() {
  await requireUser("/onboarding");
  if ((await getHouseholds()).length > 0) redirect("/app");

  return (
    <CenteredPage>
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black">{fr.household.createTitle}</h1>
        <p className="text-muted">{fr.household.createLead}</p>
      </div>
      <Card>
        <CreateHouseholdForm />
      </Card>
      <p className="text-sm text-muted">{fr.household.joinHint}</p>
    </CenteredPage>
  );
}
