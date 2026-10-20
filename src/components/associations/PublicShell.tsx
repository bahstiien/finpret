import Image from "next/image";
import Link from "next/link";
import { associationsFr } from "@/i18n/associations";

const t = associationsFr;

/** En-tête simple des pages publiques (hors page d'accueil, qui a son propre bandeau). */
export function PublicHeader({ signup = true }: { signup?: boolean }) {
  return (
    <header className="theme-light bg-violet text-white">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Fin Prêt, accueil" className="rounded-pill">
          <Image
            src="/brand/finpret-logo-inverse.png"
            alt="Fin Prêt"
            width={1040}
            height={300}
            priority
            className="h-11 w-auto"
          />
        </Link>
        <nav aria-label={t.nav.label} className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/associations/comment-ca-marche"
            className="hidden min-h-11 items-center rounded-pill px-4 font-bold hover:bg-white/15 md:inline-flex"
          >
            {t.nav.how}
          </Link>
          {signup && (
            <Link
              href="/asso/inscription"
              className="inline-flex min-h-11 items-center rounded-pill bg-banana px-5 font-extrabold text-[#17151f]"
            >
              {t.nav.signup}
            </Link>
          )}
        </nav>
      </div>
    </header>
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
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
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
