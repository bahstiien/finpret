import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { fr } from "@/i18n/fr";
import { ASSOCIATION_COOKIE } from "@/lib/association-code";
import { onboardingDefaults } from "@/lib/onboarding";
import { cookies } from "next/headers";
import { approvedAssociation } from "@/server/associations";
import { TermsGate } from "@/components/onboarding/TermsGate";
import { onboardingDishes } from "@/server/onboarding-data";
import { hasAcceptedTerms } from "@/server/terms";
import { getActiveHousehold, getProfile, requireUser, withSession } from "@/server/session";

export const metadata: Metadata = { title: fr.onboarding.title };

/** Bienvenue puis 4 étapes (§5) : pour un nouveau compte, ou un foyer créé mais pas encore paramétré. */
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const household = await getActiveHousehold();
  if (household) {
    const { data, week } = await withSession(async (db) => ({
      data: await db
        .selectFrom("households")
        .select(["onboarded_at", "name"])
        .where("id", "=", household.id)
        .executeTakeFirst(),
      week: await db
        .selectFrom("weeks")
        .select("id")
        .where("household_id", "=", household.id)
        .executeTakeFirst(),
    }));
    // Paramétré sans semaine (génération échouée) : on reste ici pour réessayer ou revoir les réponses.
    if ((data?.onboarded_at && week) || household.role !== "admin") redirect("/app");
  }
  // Compte ouvert par lien magique ou Google : accord sur les CGU avant tout paramétrage.
  if (!(await hasAcceptedTerms(user.id))) return <TermsGate />;
  const association = await approvedAssociation((await cookies()).get(ASSOCIATION_COOKIE)?.value);
  const [profile, ingredients, dishes] = await Promise.all([
    getProfile(),
    withSession((db) =>
      db
        .selectFrom("ingredients")
        .select(["key", "label"])
        .where("aisle", "!=", "base")
        .orderBy("label")
        .execute(),
    ),
    onboardingDishes(),
  ]);
  // Le nom par défaut du profil est la partie locale de l'e-mail : on ne le propose pas comme prénom.
  const displayName = profile?.display_name ?? "";
  // (tronquée à 60 caractères par la base) ; un prénom fait au plus 40 caractères.
  const fromEmail = !!displayName && (user.email?.split("@")[0] ?? "").startsWith(displayName);
  const initial = onboardingDefaults(fromEmail ? "" : displayName.slice(0, 40));
  if (household) initial.household.name = household.name;

  return (
    <OnboardingWizard
      initial={initial}
      ingredients={ingredients}
      schools={association?.schools ?? []}
      associationName={association?.name ?? null}
      dishes={dishes}
      fromAccount={!fromEmail && !!displayName}
    />
  );
}
