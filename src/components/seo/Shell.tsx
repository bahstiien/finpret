import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CTA_LABEL, SIGNUP_PATH } from "@/seo/config";
import type { Crumb } from "@/seo/jsonld";

/** Cadre des pages publiques SEO : serveur uniquement, aucun JavaScript client. */

const NAV = [
  ["/recettes", "Recettes"],
  ["/menus", "Menus de la semaine"],
  ["/batch-cooking", "Batch cooking"],
] as const;

export function SeoHeader() {
  return (
    <header className="theme-light bg-violet text-white">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Fin Prêt, accueil" className="rounded-pill">
          <Image src="/brand/finpret-logo-inverse.png" alt="Fin Prêt" width={1040} height={300} className="h-11 w-auto" />
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-1 sm:gap-2">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="hidden min-h-11 items-center rounded-pill px-4 font-bold hover:bg-white/15 md:inline-flex"
            >
              {label}
            </Link>
          ))}
          <Link
            href={SIGNUP_PATH}
            className="inline-flex min-h-11 items-center rounded-pill bg-banana px-5 font-extrabold text-[#17151f]"
          >
            Commencer
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SeoFooter() {
  const links = [
    ["/recettes", "Toutes les recettes"],
    ["/menus", "Menus de la semaine"],
    ["/batch-cooking", "Batch cooking"],
    ["/mentions-legales", "Mentions légales"],
    ["/cgu", "CGU"],
    ["/confidentialite", "Confidentialité"],
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
        </ul>
      </nav>
    </footer>
  );
}

/** Fil d'Ariane visible (le JSON-LD BreadcrumbList est émis par la page). */
export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2">
        {crumbs.map((c, i) => (
          <li key={c.path} className="flex items-center gap-x-2">
            {i > 0 && <span aria-hidden="true">›</span>}
            {i === crumbs.length - 1 ? (
              <span aria-current="page">{c.name}</span>
            ) : (
              <Link href={c.path} className="inline-flex min-h-11 items-center underline underline-offset-4">
                {c.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** CTA de fin de page : inscription gratuite. */
export function Cta() {
  return (
    <section aria-labelledby="cta" className="theme-light mt-12 rounded-card bg-violet p-6 text-white sm:p-10">
      <h2 id="cta" className="text-2xl font-extrabold sm:text-3xl">
        {CTA_LABEL}
      </h2>
      <p className="mt-2 max-w-xl text-white/90">
        Fin Prêt compose ta semaine selon ton foyer et la saison, et prépare ta liste de courses.
      </p>
      <Link
        href={SIGNUP_PATH}
        className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-pill bg-banana px-8 text-base font-extrabold text-[#17151f]"
      >
        {CTA_LABEL}
      </Link>
    </section>
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-8">{children}</main>;
}

export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <section aria-labelledby="faq" className="mt-10">
      <h2 id="faq" className="text-2xl font-extrabold">
        Questions fréquentes
      </h2>
      <dl className="mt-4 flex flex-col gap-4">
        {items.map((f) => (
          <div key={f.q} className="rounded-card bg-surface p-5">
            <dt className="font-bold">{f.q}</dt>
            <dd className="mt-1 text-muted">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
