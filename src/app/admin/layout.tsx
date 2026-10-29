import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminIdentity } from "@/server/admin";

export const metadata: Metadata = { title: "Back-office", robots: { index: false, follow: false } };

const LINKS = [
  ["/admin/associations", "Associations"],
  ["/admin/ecoles", "Écoles"],
  ["/admin/menus", "Menus"],
  ["/admin/abonnements", "Abonnements"],
  ["/admin/reversements", "Reversements"],
  ["/admin/prospects", "Prospects"],
  ["/admin/support", "Support"],
  ["/admin/journal", "Journal"],
] as const;

/** Back-office : réservé aux comptes de la table `admins` (les autres obtiennent une page introuvable). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminIdentity();
  // Back-office : bordures de 2 px partout (le jeton --bw est figé sur toute la zone), ombres retirées des tableaux.
  return (
    <div className="min-h-dvh [--bw:2px]">
      <header className="topbar">
        <Link href="/admin" className="inline-flex items-center gap-3">
          <span className="logo-mark" aria-hidden="true">
            M
          </span>
          <span className="t-kicker">Fin Prêt · Back-office</span>
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 min-[900px]:px-10">
        <nav aria-label="Back-office">
          <ul className="flex flex-wrap gap-2">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="btn btn--outline btn--sm">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex flex-col gap-4">{children}</main>
      </div>
    </div>
  );
}
