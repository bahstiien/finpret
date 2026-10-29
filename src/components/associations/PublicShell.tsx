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
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-card focus:bg-banana focus:px-4 focus:py-2 focus:font-semibold focus:text-[#17151f] border-[length:var(--bw)] border-line"
      >
        {t.nav.skip}
      </a>
      <PublicNav signup={signup} />
      <div aria-hidden="true" className="h-24" />
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
    <footer className="mx-auto w-full max-w-[1240px] px-4 py-10 text-sm sm:px-8">
      <nav aria-label="Liens du pied de page">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {links.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-11 items-center underline underline-offset-4">
                {label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href={`mailto:${f.contact}`}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {f.contact}
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
