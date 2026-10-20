import Link from "next/link";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { AppFrame } from "@/components/ui/AppFrame";
import { fr } from "@/i18n/fr";
import { ADMIN_SECTIONS, MEMBER_SECTIONS } from "@/lib/settings-sections";
import { createClient } from "@/lib/supabase/server";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold } from "@/server/session";
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
    const supabase = await createClient();
    const { count } = await supabase
      .from("shopping_items")
      .select("id", { count: "exact", head: true })
      .eq("week_id", week.id)
      .eq("checked", false);
    left = count ?? 0;
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
