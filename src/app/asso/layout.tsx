import type { Metadata } from "next";
import Link from "next/link";
import { fr } from "@/i18n/fr";
import { getMyAssociation } from "@/server/asso-session";

const t = fr.asso;

export const metadata: Metadata = { title: "Espace association", robots: { index: false, follow: false } };

/** Espace des associations de parents : le responsable voit tout, un éditeur ne voit que les menus. */
export default async function AssoLayout({ children }: { children: React.ReactNode }) {
  const association = await getMyAssociation();
  const links = association
    ? [
        ...(association.role === "manager" ? [{ href: "/asso", label: t.nav.dashboard }] : []),
        { href: "/asso/menus", label: t.nav.menus },
        ...(association.role === "manager" ? [{ href: "/asso/equipe", label: t.nav.team }] : []),
        { href: "/asso/kit", label: t.nav.kit },
        ...(association.role === "manager" ? [{ href: "/asso/releves", label: t.nav.statements }] : []),
      ]
    : [];
  return (
    <div className="min-h-dvh">
      <header className="topbar">
        <Link href="/app" className="lnk t-small">
          ← {t.nav.back}
        </Link>
        {association && <p className="t-kicker truncate">{association.name}</p>}
      </header>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 min-[900px]:px-10">
        {association && (
          <nav aria-label={t.nav.label}>
            <ul className="flex flex-wrap gap-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="btn btn--outline btn--sm">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <main className="flex flex-col gap-4">{children}</main>
      </div>
    </div>
  );
}
