import Link from "next/link";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { AppFrame } from "@/components/ui/AppFrame";
import { fr } from "@/i18n/fr";
import { ADMIN_SECTIONS, MEMBER_SECTIONS } from "@/lib/settings-sections";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold, withSession } from "@/server/session";
import { currentAndNext } from "@/server/weeks";
import { PageHeader } from "@/components/ui/Layout";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { household } = await requireHousehold("/settings");
  const sections = household.role === "admin" ? ADMIN_SECTIONS : MEMBER_SECTIONS;
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
      <Link href="/app" className="self-start text-sm font-semibold text-muted underline min-[900px]:hidden">
        ← {fr.settings.back}
      </Link>
      <PageHeader title={fr.settings.title} />
      <SettingsNav sections={[...sections]} />
      <div className="flex max-w-3xl flex-col gap-5">{children}</div>
    </AppFrame>
  );
}
