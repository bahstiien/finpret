import Link from "next/link";
import { associationsFr } from "@/i18n/associations";
import { PublicNav } from "./PublicNav";

const t = associationsFr;

/**
 * En-tête des pages publiques : lien d'évitement, barre flottante (fixe, hors du flux) et espace réservé
 * de 96 px pour que le contenu démarre sous elle.
 */
export function PublicHeader({ signup = true }: { signup?: boolean }) {
  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:btn focus:btn--primary"
      >
        {t.nav.skip}
      </a>
      <PublicNav signup={signup} />
    </>
  );
}

/** Pied de page commun aux pages publiques : liens internes (maillage) et pages légales. */
export function PublicFooter() {
  const f = t.footer;
  const links = [
    ["/associations", f.associations],
    ["/associations/comment-ca-marche", f.howItWorks],
    ["/mentions-legales", f.legal],
    ["/cgu", f.cgu],
    ["/cgv", f.cgv],
    ["/confidentialite", f.privacy],
    ["/partenariat-associations", f.partnership],
  ] as const;
  return (
    <footer className="border-t-[length:var(--bw)] border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 py-8 min-[900px]:px-10">
        <nav aria-label="Liens du pied de page">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="lnk t-small">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${f.contact}`} className="lnk t-small">
                {f.contact}
              </a>
            </li>
          </ul>
        </nav>
        <p className="mono t-small font-bold">finpret.app</p>
      </div>
    </footer>
  );
}
