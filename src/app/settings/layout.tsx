import Link from "next/link";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { fr } from "@/i18n/fr";
import { ADMIN_SECTIONS, MEMBER_SECTIONS } from "@/lib/settings-sections";
import { requireHousehold } from "@/server/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { household } = await requireHousehold("/settings");
  const sections = household.role === "admin" ? ADMIN_SECTIONS : MEMBER_SECTIONS;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Link href="/app" className="self-start text-sm font-semibold text-muted underline">
        ← {fr.settings.back}
      </Link>
      <h1 className="text-4xl font-black">{fr.settings.title}</h1>
      <SettingsNav sections={[...sections]} />
      <main className="flex flex-col gap-5">{children}</main>
    </div>
  );
}
