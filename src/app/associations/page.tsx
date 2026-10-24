import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { LeadForm } from "@/components/associations/LeadForm";
import { PublicFooter, PublicHeader } from "@/components/associations/PublicShell";
import { Simulator } from "@/components/associations/Simulator";
import { SignupLink, Track } from "@/components/associations/Track";
import { Phone } from "@/components/landing/Phone";
import { Container, SectionTitle } from "@/components/landing/Section";
import { associationsFr, SITE_URL } from "@/i18n/associations";
import { nb } from "@/lib/typography";
import { Card } from "@/components/ui/Card";

const t = associationsFr;
const URL = `${SITE_URL}/associations`;

// Page entièrement statique : HTML complet sans JavaScript (SPEC_JANVIER §8 bis A). Seul le simulateur est interactif.
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
    type: "website",
    siteName: "Fin Prêt",
  },
  twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description },
};

const ctaClass =
  "inline-flex min-h-[52px] items-center justify-center rounded-pill bg-banana px-8 text-base font-extrabold text-[#17151f] transition hover:brightness-95";

export default function AssociationsPage() {
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
      "@type": "FAQPage",
      mainEntity: t.faq.items.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.breadcrumbs.home, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: t.breadcrumbs.associations, item: URL },
      ],
    },
  ];
  return (
    <>
      {structured.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <Track event="asso_landing_view" />
      <PublicHeader />
      <main id="contenu">
        <section className="theme-light bg-violet text-white">
          <Container className="grid items-center gap-10 pt-6 pb-14 lg:grid-cols-[1.1fr_0.9fr] lg:pb-20">
            <div className="flex flex-col items-start gap-6">
              <h1 className="text-[40px] leading-[1.05] font-black tracking-[-0.02em] sm:text-6xl">
                {nb(t.hero.title)}
              </h1>
              <p className="max-w-xl text-lg font-bold">{nb(t.hero.lead)}</p>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <SignupLink href="/asso/inscription" className={ctaClass}>
                  {t.hero.cta}
                </SignupLink>
                <a
                  href="#comment"
                  className="inline-flex min-h-11 items-center px-3 font-bold underline underline-offset-4"
                >
                  {t.hero.secondary}
                </a>
              </div>
            </div>
            <div className="flex justify-center">
              <Phone label={t.hero.visualAlt} height="h-[420px]">
                <div className="flex flex-col gap-3 px-4 pt-2">
                  <p className="text-xs font-bold text-muted">{t.hero.today}</p>
                  <Card as="div" padding="sm">
                    <p className="text-xs font-semibold text-muted">{t.hero.cantine}</p>
                    <p className="mt-1 text-lg font-extrabold">Poulet rôti, riz</p>
                  </Card>
                  <p className="rounded-2xl bg-peach px-3 py-2 text-sm font-semibold text-peach-ink">
                    {t.hero.alert}
                  </p>
                  <div className="rounded-card bg-violet-soft p-4 text-violet-strong">
                    <p className="text-xs font-semibold">Ce soir</p>
                    <p className="font-extrabold">Gratin de courge</p>
                  </div>
                </div>
              </Phone>
            </div>
          </Container>
        </section>

        <Container className="flex flex-col gap-16 py-16 sm:py-24">
          <section aria-labelledby="probleme" className="flex flex-col gap-6">
            <SectionTitle id="probleme" title={t.problem.title} />
            <ul className="grid gap-4 md:grid-cols-3">
              {t.problem.cards.map((c) => (
                <Card as="li" key={c} className="text-lg font-bold">
                  {nb(c)}
                </Card>
              ))}
            </ul>
          </section>

          <section aria-labelledby="comment" className="flex flex-col gap-6">
            <SectionTitle id="comment" title={t.how.title} />
            <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {t.how.steps.map((s, i) => (
                <Card as="li" key={s} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet font-display text-lg font-black text-white">
                    {i + 1}
                  </span>
                  <span className="font-bold">{nb(s)}</span>
                </Card>
              ))}
            </ol>
            <Link
              href="/associations/comment-ca-marche"
              className="self-start font-bold underline underline-offset-4"
            >
              {t.footer.howItWorks}
            </Link>
          </section>

          <section aria-labelledby="familles" className="flex flex-col gap-6">
            <SectionTitle id="familles" title={t.families.title} />
            <ul className="grid gap-4 md:grid-cols-2">
              {t.families.items.map((c) => (
                <Card as="li" key={c} className="font-bold">
                  {nb(c)}
                </Card>
              ))}
            </ul>
            <Card as="p" tone="yellow" className="text-lg font-bold">
              {nb(t.families.benefit)}
            </Card>
          </section>

          <section aria-labelledby="simulateur" className="flex flex-col gap-6">
            <SectionTitle id="simulateur" title={t.simulator.title} />
            <Simulator />
          </section>

          <section aria-labelledby="zero" className="flex flex-col gap-6">
            <SectionTitle id="zero" title={t.zero.title} />
            <ul className="grid gap-4 md:grid-cols-4">
              {t.zero.items.map((c) => (
                <Card as="li" tone="green" key={c} className="font-bold">
                  {nb(c)}
                </Card>
              ))}
            </ul>
          </section>

          <section aria-labelledby="confiance" className="flex flex-col gap-6">
            <SectionTitle id="confiance" title={t.trust.title} />
            <ul className="flex flex-col gap-3">
              {t.trust.items.map((c) => (
                <Card as="li" padding="cozy" key={c} className="font-semibold">
                  {nb(c)}
                </Card>
              ))}
            </ul>
          </section>

          {t.testimonial.quote && (
            <Card as="figure" padding="lg">
              <blockquote className="text-xl font-bold">{nb(t.testimonial.quote)}</blockquote>
              <figcaption className="mt-3 text-muted">{t.testimonial.author}</figcaption>
            </Card>
          )}

          <section aria-labelledby="faq" className="flex flex-col gap-6">
            <SectionTitle id="faq" title={t.faq.title} />
            <dl className="flex flex-col gap-3">
              {t.faq.items.map((f) => (
                <Card as="div" key={f.q}>
                  <dt className="text-lg font-extrabold">{nb(f.q)}</dt>
                  <dd className="mt-2 text-muted">{nb(f.a)}</dd>
                </Card>
              ))}
            </dl>
          </section>

          <section
            aria-labelledby="final"
            className="flex flex-col items-start gap-5 rounded-sheet bg-violet p-8 text-white theme-light sm:p-12"
          >
            <h2 id="final" className="text-3xl font-black sm:text-5xl">
              {nb(t.final.title)}
            </h2>
            <SignupLink href="/asso/inscription" className={ctaClass}>
              {t.final.cta}
            </SignupLink>
            <a
              href="#presentation"
              className="inline-flex min-h-11 items-center font-bold underline underline-offset-4"
            >
              {nb(t.final.lead)}
            </a>
          </section>

          <LeadForm />
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
