import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { dur } from "@/engine/format";
import { slotMap } from "@/engine/week";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { signOut } from "@/server/actions/auth";
import { switchHousehold } from "@/server/actions/households";
import { generateWeekAction } from "@/server/actions/weeks";
import { loadHouseholdContext } from "@/server/household-context";
import { getHouseholds, getProfile, requireHousehold } from "@/server/session";
import { currentAndNext, engineEnvFor, summarize } from "@/server/weeks";

export const metadata: Metadata = { title: "Menu" };

// M4 : récapitulatif de la semaine ; l'écran Menu complet arrive en M5 (§8.1).
export default async function AppHomePage() {
  const { user, household } = await requireHousehold("/app");
  const ctx = await loadHouseholdContext(household.id);
  if (!ctx.onboardedAt && household.role === "admin") redirect("/onboarding");
  const [profile, households] = await Promise.all([getProfile(), getHouseholds()]);
  const name = profile?.display_name ?? user.email ?? "";
  const canEdit = household.role !== "viewer";
  const { current, next, nextStart } = currentAndNext(ctx);
  const week = current ?? next;
  const env = week ? await engineEnvFor(ctx) : null;
  const summary = week && env ? await summarize(ctx, week.plan, env) : null;
  const map = week && env ? slotMap(env, week.plan) : {};

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-black">{fr.appShell.hello(name)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="violet" data-testid="active-household">
            {household.name}
          </Pill>
          <Pill>{fr.roles[household.role]}</Pill>
        </div>
      </header>

      {!ctx.onboardedAt ? (
        <Card>
          <p className="text-muted">{fr.menu.finishSetup}</p>
        </Card>
      ) : week && summary ? (
        <>
          <h2 className="text-2xl font-extrabold" data-testid="week-title">
            {fr.menu.weekOf(formatShort(week.start_date))}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3" data-testid="week-summary">
            <li className="rounded-card bg-violet p-5 text-white">
              <span className="block font-display text-3xl font-black" data-testid="summary-meals">
                {summary.meals}
              </span>
              <span className="text-sm font-semibold">{fr.menu.meals}</span>
            </li>
            <li className="rounded-card bg-blue-soft p-5 text-blue-ink">
              <span className="block font-display text-3xl font-black">{dur(summary.sessionMinutes)}</span>
              <span className="text-sm font-semibold">{fr.menu.session}</span>
            </li>
            <li className="rounded-card bg-pink-soft p-5 text-pink-ink">
              <span className="block font-display text-3xl font-black">{summary.shoppingItems}</span>
              <span className="text-sm font-semibold">{fr.menu.shopping}</span>
            </li>
          </ul>
          <Card>
            <ul className="flex flex-col divide-y divide-line">
              {[1, 2, 3, 4, 5].map((d) => (
                <li key={d} className="grid grid-cols-[6rem_1fr] gap-2 py-3">
                  <span className="font-bold capitalize">{fr.days[d - 1]}</span>
                  <span className="flex flex-col gap-1">
                    {(["lunch", "dinner"] as const).map((meal) => {
                      const entry = map[`${d}-${meal}`];
                      const removed = week.plan.removed.includes(`${d}-${meal}`);
                      return (
                        <span key={meal}>
                          <span className="text-sm text-muted">{fr.meals[meal]} · </span>
                          {entry && !removed ? (
                            entry.r.n
                          ) : (
                            <span className="text-muted">{fr.menu.nothing}</span>
                          )}
                        </span>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <Card className="flex flex-col gap-4">
          <p className="text-muted">{fr.menu.noWeek}</p>
          {canEdit && (
            <ActionForm
              action={generateWeekAction.bind(null, nextStart)}
              fields={{}}
              label={fr.menu.prepare}
              variant="primary"
            />
          )}
        </Card>
      )}

      {households.length > 1 && (
        <Card>
          <form action={switchHousehold} className="flex flex-wrap items-end gap-3">
            <SelectField
              id="householdId"
              name="householdId"
              label={fr.household.switchLabel}
              defaultValue={household.id}
              className="min-w-56 flex-1"
            >
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </SelectField>
            <Button type="submit" variant="outline">
              {fr.household.switch}
            </Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center rounded-pill bg-surface px-6 font-bold"
        >
          {fr.appShell.settings}
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="dark">
            {fr.appShell.signOut}
          </Button>
        </form>
      </div>
    </main>
  );
}
