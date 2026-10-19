import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingRecap } from "@/components/onboarding/OnboardingRecap";
import { fr } from "@/i18n/fr";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold } from "@/server/session";
import { summarize } from "@/server/weeks";

export const metadata: Metadata = { title: fr.onboarding.recap.title };

/** Récapitulatif après l'onboarding : la première semaine générée (§5). */
export default async function OnboardingRecapPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { household } = await requireHousehold("/onboarding/recap");
  const { week: start } = await searchParams;
  const ctx = await loadHouseholdContext(household.id);
  const week = ctx.weeks.find((w) => w.start_date === start) ?? ctx.weeks[0];
  if (!week) redirect("/app");
  const summary = await summarize(ctx, week.plan);
  return (
    <main>
      <OnboardingRecap result={{ start: week.start_date, summary }} />
    </main>
  );
}
