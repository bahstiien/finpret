import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdminIdentity } from "@/server/admin";
import { navBadges } from "@/server/admin-board";

export const metadata: Metadata = { title: "Back-office", robots: { index: false, follow: false } };

/** Back-office : réservé aux comptes de la table `admins` (les autres obtiennent une page introuvable). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { mfaVerified } = await requireAdminIdentity();
  // Les compteurs du menu attendent le second facteur, comme toutes les données du back-office.
  const badges = mfaVerified ? await navBadges() : { inbox: 0, tasks: 0 };
  // Back-office : bordures de 2 px partout (le jeton --bw est figé sur toute la zone), ombres retirées des tableaux.
  return (
    <div className="min-h-dvh [--bw:2px] min-[1000px]:flex">
      <AdminNav badges={badges} />
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-4 px-4 py-8 min-[900px]:px-10">
        {children}
      </main>
    </div>
  );
}
