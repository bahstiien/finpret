import Link from "next/link";
import { associationsFr } from "@/i18n/associations";

const t = associationsFr.nav;

const links = [
  { href: "/associations", label: t.associations },
  { href: "/associations/comment-ca-marche", label: t.how },
] as const;

/** Barre des pages publiques (maquette) : logo, liens en boutons fantômes, action jaune. Les liens passent au pied de page sur mobile. */
export function PublicNav({ signup = true }: { signup?: boolean }) {
  return (
    <header className="border-b-[length:var(--bw)] border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-4 py-3 min-[900px]:px-10">
        <Link href="/" aria-label={t.homeAria} className="logo">
          <span className="logo-mark" aria-hidden="true">
            M
          </span>
          {t.home}
        </Link>
        <nav aria-label={t.label} className="hidden gap-1 min-[900px]:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="btn btn--ghost btn--sm">
              {l.label}
            </Link>
          ))}
        </nav>
        {signup && (
          <Link href="/asso/inscription" className="btn btn--primary btn--sm">
            {t.signup}
          </Link>
        )}
      </div>
    </header>
  );
}
