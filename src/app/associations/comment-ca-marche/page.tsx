import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { PublicFooter, PublicHeader } from "@/components/associations/PublicShell";
import { SignupLink } from "@/components/associations/Track";
import { Container } from "@/components/landing/Section";
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
        <Container className="flex max-w-3xl flex-col gap-10 py-12 sm:py-20">
          <nav aria-label="Fil d'Ariane" className="text-sm">
            <Link href="/" className="underline underline-offset-4">
              {crumbs.home}
            </Link>{" "}
            ›{" "}
            <Link href="/associations" className="underline underline-offset-4">
              {crumbs.associations}
            </Link>{" "}
            › {crumbs.how}
          </nav>
          <header className="flex flex-col gap-4">
            <h1 className="text-4xl font-black tracking-[-0.01em] sm:text-5xl">{nb(t.title)}</h1>
            <p className="text-lg text-muted">{nb(t.lead)}</p>
          </header>
          {t.sections.map((s) => (
            <section key={s.id} aria-labelledby={s.id} className="flex flex-col gap-4">
              <h2 id={s.id} className="text-2xl font-extrabold sm:text-3xl">
                {nb(s.title)}
              </h2>
              {s.paragraphs?.map((p) => (
                <p key={p}>{nb(p)}</p>
              ))}
              {s.ordered && (
                <ol className="flex list-decimal flex-col gap-2 pl-6">
                  {s.ordered.map((p) => (
                    <li key={p}>{nb(p)}</li>
                  ))}
                </ol>
              )}
              {s.bullets && (
                <ul className="flex list-disc flex-col gap-2 pl-6">
                  {s.bullets.map((p) => (
                    <li key={p}>{nb(p)}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <div className="flex flex-wrap items-center gap-4">
            <SignupLink
              href="/asso/inscription"
              className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-banana px-8 font-extrabold text-[#17151f]"
            >
              {t.cta}
            </SignupLink>
            <Link href="/associations" className="font-bold underline underline-offset-4">
              {t.back}
            </Link>
          </div>
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
