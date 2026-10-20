import Link from "next/link";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { fr } from "@/i18n/fr";
import { requireHousehold } from "@/server/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireHousehold("/settings");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Link href="/app" className="self-start text-sm font-semibold text-muted underline">
        ← {fr.settingsAccount.back}
      </Link>
      <h1 className="text-4xl font-black">{fr.settingsAccount.title}</h1>
      <SettingsNav />
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
