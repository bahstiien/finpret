import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { fr } from "@/i18n/fr";
import { ASSOCIATION_COOKIE } from "@/lib/association-code";
import { onboardingDefaults } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { approvedAssociation } from "@/server/associations";
import { getActiveHousehold, getProfile, requireUser } from "@/server/session";

export const metadata: Metadata = { title: fr.onboarding.title };

/** Assistant en 5 étapes (§5) : pour un nouveau compte, ou un foyer créé mais pas encore paramétré. */
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const supabase = await createClient();
  const household = await getActiveHousehold();
  if (household) {
    const { data } = await supabase
      .from("households")
      .select("onboarded_at, name")
      .eq("id", household.id)
      .single();
    if (data?.onboarded_at || household.role !== "admin") redirect("/app");
  }
  const association = await approvedAssociation((await cookies()).get(ASSOCIATION_COOKIE)?.value);
  const [profile, ingredients] = await Promise.all([
    getProfile(),
    supabase.from("ingredients").select("key, label").neq("aisle", "base").order("label"),
  ]);
  // Le nom par défaut du profil est la partie locale de l'e-mail : on ne le propose pas comme prénom.
  const displayName = profile?.display_name ?? "";
  // (tronquée à 60 caractères par la base) ; un prénom fait au plus 40 caractères.
  const fromEmail = !!displayName && (user.email?.split("@")[0] ?? "").startsWith(displayName);
  const initial = onboardingDefaults(fromEmail ? "" : displayName.slice(0, 40));
  if (household) initial.household.name = household.name;

  return (
    <main>
      <OnboardingWizard
        initial={initial}
        ingredients={ingredients.data ?? []}
        schools={association?.schools ?? []}
        associationName={association?.name ?? null}
      />
    </main>
  );
}
