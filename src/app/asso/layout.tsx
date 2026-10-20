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
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Link href="/app" className="self-start text-sm font-semibold text-muted underline">
        ← {t.nav.back}
      </Link>
      {association && (
        <>
          <p className="text-sm font-bold tracking-wide text-violet uppercase">{association.name}</p>
          <nav aria-label={t.nav.label}>
            <ul className="flex flex-wrap gap-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-11 items-center rounded-pill bg-surface px-5 font-bold hover:bg-chip"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
      <main className="flex flex-col gap-5">{children}</main>
    </div>
  );
}
