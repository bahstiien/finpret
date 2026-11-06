import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingRecap, type RecapDay } from "@/components/onboarding/OnboardingRecap";
import { fr } from "@/i18n/fr";
import { addDays, formatLong, formatShort, todayIn } from "@/lib/dates";
import { buildMenuView } from "@/server/menu-view";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { requireHousehold, withSession } from "@/server/session";
import { engineEnvFor, summarize } from "@/server/weeks";

export const metadata: Metadata = { title: fr.onboarding.flow.recap.title };

/** Récapitulatif après l'onboarding : la première semaine générée, plat par plat, en photos (§5). */
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
  const env = await engineEnvFor(ctx);
  const today = todayIn(ctx.timezone);
  const view = buildMenuView(ctx, env, week, portionModelFor(ctx, week.start_date), today);
  const summary = await summarize(ctx, week.plan, env);

  // Enfants à la cantine (code d'association), essai de l'association.
  const children = ctx.members.filter((m) => m.kind === "child");
  const { canteen, trial } = await withSession(async (db) => {
    const canteen = children.length
      ? await db
          .selectFrom("member_schools")
          .select(["member_id", "canteen_days"])
          .where(
            "member_id",
            "in",
            children.map((c) => c.id),
          )
          .execute()
      : [];
    const trial = await db
      .selectFrom("households as h")
      .innerJoin("associations as a", "a.id", "h.association_id")
      .leftJoin("subscriptions as s", "s.household_id", "h.id")
      .select(["a.name", "s.trial_ends_at", "s.plan"])
      .where("h.id", "=", household.id)
      .executeTakeFirst();
    return { canteen, trial };
  });

  const days: RecapDay[] = view.days
    .map((d) => ({
      label: formatLong(d.iso),
      meals: d.meals
        .filter((m) => !m.removed && m.photo)
        .map((m) => ({ meal: m.meal, name: m.name, photo: m.photo! })),
      canteen: canteen
        .filter((c) => c.canteen_days.includes(d.day))
        .map((c) => children.find((k) => k.id === c.member_id)?.name ?? "")
        .filter(Boolean),
    }))
    .filter((d) => d.meals.length);

  const session = ctx.settings.session;
  // Jour de session (0 = dimanche) : la veille du lundi pour le dimanche, sinon le jour de la semaine.
  const sessionDate = addDays(
    week.start_date,
    session.day === 0 ? -1 : session.day === 6 ? -2 : session.day - 1,
  );

  return (
    <OnboardingRecap
      start={formatShort(week.start_date)}
      summary={summary}
      session={`${formatLong(sessionDate)}, ${session.time.replace(":", " h ")}`}
      days={days}
      trial={
        trial && trial.plan === "trial" && trial.trial_ends_at
          ? { association: trial.name, until: formatShort(trial.trial_ends_at.slice(0, 10)) }
          : null
      }
    />
  );
}
