import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { groupsFor } from "@/lib/settings-sections";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: fr.settings.title };

const t = fr.settings;

function Row({ href, label, hint, icon }: { href: string; label: string; hint: string; icon?: "passport" }) {
  return (
    <li className="border-line not-last:border-b-[length:var(--bw)]">
      <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-chip">
        {icon && <Icon name={icon} className="size-5 shrink-0" />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="t-ui font-bold">{label}</span>
          <span className="text-sm text-muted">{hint}</span>
        </span>
        <Icon name="chevronRight" className="size-5 shrink-0" />
      </Link>
    </li>
  );
}

/** Accueil des réglages : toutes les sections, rangées par groupe. Un membre n'a que son Profil. */
export default async function SettingsIndex() {
  const { household } = await requireHousehold("/settings");
  if (household.role !== "admin") redirect("/settings/profile");
  return groupsFor(household.role).map((g) => (
    <section key={g.key} className="flex flex-col gap-2" aria-labelledby={`group-${g.key}`}>
      <h2 id={`group-${g.key}`} className="t-kicker muted">
        {t.groups[g.key]}
      </h2>
      <Card as="ul" padding="none" className="overflow-hidden">
        {g.sections.map((s) => (
          <Row key={s} href={`/settings/${s}`} label={t.sections[s]} hint={t.hints[s]} />
        ))}
        {g.key === "account" && (
          <Row href="/app/progress?from=profile" label={fr.progress.nav} hint={t.progressHint} icon="passport" />
        )}
      </Card>
    </section>
  ));
}
