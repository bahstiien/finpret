import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { PublicFooter, PublicHeader } from "@/components/associations/PublicShell";
import { SignupLink } from "@/components/associations/Track";
import { Icon } from "@/components/landing/Icon";
import { Container } from "@/components/landing/Section";
import { Breadcrumbs } from "@/components/ui/Extras";
import { associationsFr, howItWorksFr, SITE_URL } from "@/i18n/associations";
import { nb } from "@/lib/typography";

const t = howItWorksFr;
const URL = `${SITE_URL}/associations/comment-ca-marche`;

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: t.meta.title },
  description: t.meta.description,
  alternates: { canonical: URL },
  openGraph: {
    title: t.meta.title,
    description: t.meta.description,
    url: URL,
    locale: "fr_FR",
    type: "article",
    siteName: "Fin Prêt",
  },
  twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description },
};

/** Version longue (longue traîne : « comment financer une sortie scolaire association »), maillée avec /associations. */
export default function HowItWorksPage() {
  const crumbs = associationsFr.breadcrumbs;
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Fin Prêt",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: t.meta.title,
      description: t.meta.description,
      url: URL,
      inLanguage: "fr",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: crumbs.home, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: crumbs.associations, item: `${SITE_URL}/associations` },
        { "@type": "ListItem", position: 3, name: crumbs.how, item: URL },
      ],
    },
  ];
  return (
    <>
      {structured.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <PublicHeader />
      <main id="contenu">
        <Container narrow className="flex flex-col gap-10 py-12 min-[900px]:py-16">
          <Breadcrumbs
            label="Fil d'Ariane"
            items={[
              { label: crumbs.home, href: "/" },
              { label: crumbs.associations, href: "/associations" },
              { label: crumbs.how },
            ]}
          />
          <header className="flex flex-col gap-4">
            <h1 className="t-1">{nb(t.title)}</h1>
            <p className="t-3 muted">{nb(t.lead)}</p>
          </header>
          {t.sections.map((s, i) => (
            <section key={s.id} aria-labelledby={s.id} className="flex flex-col gap-4">
              <div className="sh">
                <span className="sh-tag">{String(i + 1).padStart(2, "0")}</span>
                <h2 id={s.id} className="t-2">
                  {nb(s.title)}
                </h2>
                <span className="rule" />
              </div>
              {s.paragraphs?.map((p) => (
                <p key={p} className="t-body">
                  {nb(p)}
                </p>
              ))}
              {s.ordered && (
                <ol className="flex flex-col gap-3">
                  {s.ordered.map((p, n) => (
                    <li key={p} className="card flex items-start gap-3">
                      <span className="avatar tone-violet mono">{n + 1}</span>
                      <span className="t-body">{nb(p)}</span>
                    </li>
                  ))}
                </ol>
              )}
              {s.bullets && (
                <ul className="flex flex-col gap-3">
                  {s.bullets.map((p) => (
                    <li key={p} className="card tone-green flex items-start gap-3">
                      <Icon name="check" className="ic" />
                      <span className="t-body">{nb(p)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <div className="flex flex-wrap items-center gap-4">
            <SignupLink href="/asso/inscription" className="btn btn--primary btn--lg">
              {t.cta}
            </SignupLink>
            <Link href="/associations" className="lnk t-ui">
              {t.back}
            </Link>
          </div>
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
