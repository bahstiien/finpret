import { SettingsShell } from "@/components/settings/SettingsNav";
import { AppFrame } from "@/components/ui/AppFrame";
import { fr } from "@/i18n/fr";
import { groupsFor } from "@/lib/settings-sections";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold, withSession } from "@/server/session";
import { currentAndNext } from "@/server/weeks";
import { PageHeader } from "@/components/ui/Layout";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { household } = await requireHousehold("/settings");
  const ctx = await loadHouseholdContext(household.id);
  const { current, next } = currentAndNext(ctx);
  const week = next ?? current;
  let left = 0;
  if (week) {
    const { n } = await withSession((db) =>
      db
        .selectFrom("shopping_items")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("week_id", "=", week.id)
        .where("checked", "=", false)
        .executeTakeFirstOrThrow(),
    );
    left = Number(n);
  }
  return (
    <AppFrame shoppingLeft={left}>
      <PageHeader title={fr.settings.title} />
      <SettingsShell groups={groupsFor(household.role)}>{children}</SettingsShell>
    </AppFrame>
  );
}
