import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { fr } from "@/i18n/fr";
import { signOut } from "@/server/actions/auth";
import { switchHousehold } from "@/server/actions/households";
import { getHouseholds, getProfile, requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: "Menu" };

// M1 : coquille de l'onglet Menu ; l'écran complet arrive en M5 (§8.1).
export default async function AppHomePage() {
  const { user, household } = await requireHousehold("/app");
  const [profile, households] = await Promise.all([getProfile(), getHouseholds()]);
  const name = profile?.display_name ?? user.email ?? "";

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

      <Card>
        <p className="text-muted">{fr.appShell.placeholder}</p>
      </Card>

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
          href="/settings/profile"
          className="inline-flex min-h-11 items-center rounded-pill bg-banana px-6 font-bold text-[#17151F]"
        >
          {fr.appShell.account}
        </Link>
        <Link
          href="/settings/household"
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
