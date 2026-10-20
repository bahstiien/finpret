import Link from "next/link";
import { fr } from "@/i18n/fr";

/** Remplace un écran réservé à l'offre payante (le serveur refuse de toute façon l'action). */
export function UpgradeCard() {
  return (
    <section
      className="flex flex-col items-start gap-3 rounded-card bg-yellow-soft p-6"
      data-testid="upgrade"
    >
      <h2 className="text-xl font-extrabold">{fr.upgrade.title}</h2>
      <p className="text-muted">{fr.upgrade.body}</p>
      <Link
        href="/app/abonnement"
        className="inline-flex min-h-11 items-center rounded-pill bg-banana px-6 font-bold text-[#17151F]"
      >
        {fr.upgrade.cta}
      </Link>
    </section>
  );
}
