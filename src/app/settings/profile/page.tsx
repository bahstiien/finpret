import type { Metadata } from "next";
import { ProfileNameForm } from "@/components/settings/NameForms";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { signOut } from "@/server/actions/auth";
import { switchHousehold } from "@/server/actions/households";
import { getHouseholds, getProfile, requireHousehold } from "@/server/session";

const t = fr.settingsAccount;

export const metadata: Metadata = { title: t.title };

// Section ouverte à tous les rôles (§6) : informations personnelles, foyer actif, déconnexion.
export default async function ProfileSettingsPage() {
  const { user, household } = await requireHousehold("/settings/profile");
  const [profile, households] = await Promise.all([getProfile(), getHouseholds()]);

  return (
    <>
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-extrabold">{t.you}</h2>
        <ProfileNameForm initial={profile?.display_name ?? ""} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t.email}</span>
          <span data-testid="account-email">{user.email}</span>
          <span className="text-sm text-muted">{t.emailHint}</span>
        </div>
      </Card>

      {households.length > 1 && (
        <Card>
          <form action={switchHousehold} className="flex flex-wrap items-end gap-3">
            <SelectField
              id="householdId"
              name="householdId"
              label={t.activeHousehold}
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

      <Card className="flex flex-col gap-3">
        <h2 className="text-2xl font-extrabold">{t.session}</h2>
        <form action={signOut}>
          <Button type="submit" variant="dark">
            {fr.appShell.signOut}
          </Button>
        </form>
      </Card>
    </>
  );
}
