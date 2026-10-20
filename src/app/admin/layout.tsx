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
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <Link href="/admin" className="self-start text-sm font-bold tracking-wide text-violet uppercase">
        Fin Prêt · Back-office
      </Link>
      <nav aria-label="Back-office">
        <ul className="flex flex-wrap gap-2">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                className="inline-flex min-h-11 items-center rounded-pill bg-surface px-4 font-bold hover:bg-chip"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex flex-col gap-5">{children}</main>
    </div>
  );
}
