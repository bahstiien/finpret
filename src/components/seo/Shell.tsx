import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { CTA_LABEL, SIGNUP_PATH } from "@/seo/config";
import type { Crumb } from "@/seo/jsonld";

/** Cadre des pages publiques SEO (maquette Recette-seo) : serveur uniquement, aucun JavaScript client. */

const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[900px]:px-10";

const NAV = [
  ["/recettes", "Recettes"],
  ["/menus", "Menus de la semaine"],
  ["/batch-cooking", "Batch cooking"],
] as const;

function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Fin Prêt, accueil">
      <span className="logo-mark" aria-hidden="true">
        <Icon name="pot" className="ic" />
      </span>
      Fin Prêt
    </Link>
  );
}

export function SeoHeader() {
  return (
    <header className="border-b-[length:var(--bw)] border-line bg-surface">
      <div className={`${WRAP} flex items-center justify-between gap-4 !py-3`}>
        <Logo />
        <nav aria-label="Navigation principale" className="flex items-center gap-1 sm:gap-2">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="btn btn--ghost btn--sm hidden md:inline-flex">
              {label}
            </Link>
          ))}
          <Link href={SIGNUP_PATH} className="btn btn--primary btn--sm">
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
    <footer className="border-t-[length:var(--bw)] border-line bg-surface">
      <div className={`${WRAP} flex flex-col gap-4 py-8`}>
        <nav aria-label="Liens du pied de page">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="lnk t-small inline-flex min-h-11 items-center">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mono t-small font-bold">finpret.app</p>
      </div>
    </footer>
  );
}

/** Fil d'Ariane visible (le JSON-LD BreadcrumbList est émis par la page) ; la page courante est en aplat banane. */
export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="crumbs max-w-full self-start">
      {crumbs.map((c, i) =>
        i === crumbs.length - 1 ? (
          <span key={c.path} aria-current="page">
            {c.name}
          </span>
        ) : (
          <Link key={c.path} href={c.path}>
            {c.name}
          </Link>
        ),
      )}
    </nav>
  );
}

/** Titre de section : titre, filet, repère optionnel (maquette .sh). */
export function SectionHead({ id, title, tag }: { id: string; title: ReactNode; tag?: ReactNode }) {
  return (
    <div className="sh">
      <h2 id={id} className="t-2">
        {title}
      </h2>
      <span className="rule" aria-hidden="true" />
      {tag ? <span className="t-kicker mono">{tag}</span> : null}
    </div>
  );
}

/** Bandeau de fin de page : inscription gratuite. */
export function Cta() {
  return (
    <section aria-labelledby="cta" className="tone-dark border-y-[length:var(--bw)] border-line">
      <div className={`${WRAP} flex flex-wrap items-center justify-between gap-5 py-12`}>
        <div className="flex max-w-[640px] flex-col gap-2">
          <p className="t-kicker" style={{ color: "var(--banane)" }}>
            Fin Prêt
          </p>
          <h2 id="cta" className="t-1">
            {CTA_LABEL}
          </h2>
          <p className="t-body">
            Fin Prêt compose ta semaine selon ton foyer et la saison, et prépare ta liste de courses.
          </p>
        </div>
        <Link href={SIGNUP_PATH} className="btn btn--primary btn--lg">
          {CTA_LABEL}
          <Icon name="chevronRight" className="ic" />
        </Link>
      </div>
    </section>
  );
}

/** Page publique : contenu centré, puis bandeau d'inscription pleine largeur. */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1">
      <div className={`${WRAP} flex flex-col gap-8 py-8`}>{children}</div>
      <Cta />
    </main>
  );
}

export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <section aria-labelledby="faq" className="flex flex-col gap-3">
      <SectionHead id="faq" title="Questions fréquentes" />
      {items.map((f, i) => (
        <details key={f.q} className="faq" open={i === 0}>
          <summary>
            <span>{f.q}</span>
            <Icon name="chevronDown" />
          </summary>
          <div className="faq-body">{f.a}</div>
        </details>
      ))}
    </section>
  );
}

/** Lien-carte vers un hub, un menu ou une recette (maillage interne). */
export function LinkCard({
  href,
  kicker,
  title,
  tone = "",
  children,
}: {
  href: string;
  kicker?: string;
  title: ReactNode;
  tone?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={`card ${tone} flex min-h-11 flex-col gap-2 no-underline`}>
      {kicker ? <span className="t-kicker">{kicker}</span> : null}
      <span className="t-3">{title}</span>
      {children}
    </Link>
  );
}
