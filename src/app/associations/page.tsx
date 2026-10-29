import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { LeadForm } from "@/components/associations/LeadForm";
import { PublicFooter, PublicHeader } from "@/components/associations/PublicShell";
import { Reveal } from "@/components/associations/Reveal";
import { Simulator } from "@/components/associations/Simulator";
import { SignupLink, Track } from "@/components/associations/Track";
import { TaglineReveal } from "@/components/associations/TaglineReveal";
import { Icon } from "@/components/landing/Icon";
import { Phone } from "@/components/landing/Phone";
import { Container, SectionTitle } from "@/components/landing/Section";
import { associationsFr, SITE_URL } from "@/i18n/associations";
import { nb } from "@/lib/typography";
import { buttonClass } from "@/components/ui/Button";
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

// Teinte et largeur des tuiles « familles » : purement décoratives, elles reviennent en boucle
// (4 + 2 puis 2 + 4 sur la grille à 6 colonnes) ; l'icône, elle, vient des textes.
const tileTones = ["blue", "peach", "pink", "green"] as const;
const tileSpans = ["md:col-span-4", "md:col-span-2", "md:col-span-2", "md:col-span-4"] as const;

const ctaClass = buttonClass({ size: "lg" });

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
  // Saut de ligne là où la pensée s'arrête : « …de votre APE, / sans vendre de chocolats ».
  const [titleHead = t.hero.title, titleTail] = t.hero.title.split(", sans ");
  return (
    <>
      {structured.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <Track event="asso_landing_view" />
      <PublicHeader />
      <main id="contenu">
        <Container className="grid items-center gap-12 pt-8 pb-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:pb-24">
          <div className="flex flex-col items-start gap-6">
            <h1 className="max-w-[680px] bg-linear-to-r from-black to-[#666666] bg-clip-text text-4xl font-bold text-transparent sm:text-5xl dark:from-white dark:to-[#9B9B9B]">
              {nb(titleHead)}
              {titleTail ? (
                <>
                  ,<br className="hidden sm:block" /> sans {nb(titleTail)}
                </>
              ) : null}
            </h1>
            <p className="max-w-[680px] text-lg text-muted">{nb(t.hero.lead)}</p>
            <div className="flex flex-col items-stretch gap-3 self-stretch sm:flex-row sm:items-center sm:self-start">
              <SignupLink href="/asso/inscription" className={ctaClass}>
                {t.hero.cta}
              </SignupLink>
              <a
                href="#comment"
                className="inline-flex min-h-11 items-center justify-center rounded-card px-3 py-2 text-base font-semibold underline underline-offset-4"
              >
                {t.hero.secondary}
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-muted">
              {t.hero.proofs.map((p) => (
                <li key={p} className="inline-flex items-center gap-1">
                  <Icon name="check" className="size-4 text-green-strong" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center rounded-card bg-violet py-8 lg:px-8 border-[length:var(--bw)] border-line">
            <Phone label={t.hero.visualAlt} height="h-[420px]">
              <div className="flex flex-col gap-3 px-4 pt-2">
                <p className="text-xs font-bold text-muted">{t.hero.today}</p>
                <Card as="div" padding="sm">
                  <p className="text-xs font-semibold text-muted">{t.hero.cantine}</p>
                  <p className="mt-1 text-lg font-bold">Poulet rôti, riz</p>
                </Card>
                <p className="rounded-card bg-peach px-3 py-2 text-sm font-semibold text-peach-ink border-[length:var(--bw)] border-line">
                  {t.hero.alert}
                </p>
                <div className="rounded-card bg-violet-soft p-4 text-violet-strong border-[length:var(--bw)] border-line">
                  <p className="text-xs font-semibold">Ce soir</p>
                  <p className="font-bold">Gratin de courge</p>
                </div>
              </div>
            </Phone>
          </div>
        </Container>

        <Container className="flex flex-col gap-20 pb-16 sm:gap-24 sm:pb-24">
          <Reveal>
            <section aria-labelledby="probleme" className="flex flex-col gap-8">
              <SectionTitle id="probleme" title={t.problem.title} />
              <ul className="grid gap-4 md:grid-cols-3">
                {t.problem.cards.map((c) => (
                  <Card as="li" key={c} padding="cozy" className="flex items-start gap-3 text-lg font-semibold">
                    <span className="grid size-8 shrink-0 place-items-center rounded-card bg-peach text-peach-ink border-[length:var(--bw)] border-line">
                      <Icon name="close" className="size-4" />
                    </span>
                    <span>{nb(c)}</span>
                  </Card>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="comment" className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div className="flex flex-col items-start gap-6 lg:sticky lg:top-24 lg:self-start">
                <SectionTitle id="comment" title={t.how.title} />
                <Link
                  href="/associations/comment-ca-marche"
                  className="inline-flex min-h-11 items-center gap-2 rounded-card py-2 text-base font-semibold text-violet-strong underline underline-offset-4"
                >
                  {t.footer.howItWorks}
                  <Icon name="arrow" className="size-4" />
                </Link>
              </div>
              <ol className="relative flex flex-col gap-4 pl-12">
                <span aria-hidden="true" className="absolute inset-y-6 left-4 w-0.5 -translate-x-1/2 bg-violet/30" />
                {t.how.steps.map((s, i) => (
                  <li key={s.text} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 -left-12 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-violet text-sm font-bold text-white ring-4 ring-bg"
                    >
                      {i + 1}
                    </span>
                    <Card as="div" padding="cozy" className="flex items-center gap-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-card bg-violet-soft text-violet-strong border-[length:var(--bw)] border-line">
                        <Icon name={s.icon} className="size-5" />
                      </span>
                      <span className="font-semibold">{nb(s.text)}</span>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="familles" className="flex flex-col gap-8">
              <SectionTitle id="familles" title={t.families.title} />
              <ul className="grid auto-rows-fr gap-4 md:grid-cols-6">
                {t.families.items.map((c, i) => (
                  <Card
                    as="li"
                    key={c.text}
                    tone={tileTones[i % tileTones.length] ?? "surface"}
                    className={`flex flex-col justify-between gap-6 text-lg font-semibold ${tileSpans[i % tileSpans.length] ?? ""}`}
                  >
                    <Icon name={c.icon} className="size-8" />
                    <span>{nb(c.text)}</span>
                  </Card>
                ))}
                <Card as="li" tone="yellow" className="text-lg font-semibold md:col-span-6">
                  {nb(t.families.benefit)}
                </Card>
              </ul>
            </section>
          </Reveal>

          <div className="py-8 sm:py-16">
            <TaglineReveal text={t.tagline} className="max-w-[680px] text-4xl font-semibold sm:text-5xl" />
          </div>

          <Reveal>
            <section aria-labelledby="simulateur" className="flex flex-col gap-8">
              <SectionTitle id="simulateur" title={t.simulator.title} />
              <Simulator />
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="zero" className="flex flex-col gap-8">
              <SectionTitle id="zero" title={t.zero.title} />
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {t.zero.items.map((c) => (
                  <Card as="li" tone="green" key={c} padding="cozy" className="flex items-center gap-3 font-semibold">
                    <span className="grid size-8 shrink-0 place-items-center rounded-card bg-green text-white">
                      <Icon name="check" className="size-4" />
                    </span>
                    {nb(c)}
                  </Card>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="confiance" className="flex flex-col gap-8">
              <SectionTitle id="confiance" title={t.trust.title} />
              <ul className="grid gap-3 md:grid-cols-2">
                {t.trust.items.map((c, i) => (
                  <Card
                    as="li"
                    padding="cozy"
                    key={c}
                    className={`flex items-start gap-3 font-medium ${i === 0 ? "md:col-span-2" : ""}`}
                  >
                    <Icon name="shield" className="mt-1 size-5 text-violet-strong" />
                    <span>{nb(c)}</span>
                  </Card>
                ))}
              </ul>
            </section>
          </Reveal>

          {t.testimonial.quote && (
            <Reveal>
              <Card as="figure" padding="lg">
                <blockquote className="text-xl font-semibold">{nb(t.testimonial.quote)}</blockquote>
                <figcaption className="mt-3 text-muted">{t.testimonial.author}</figcaption>
              </Card>
            </Reveal>
          )}

          <Reveal>
            <section aria-labelledby="faq" className="flex flex-col gap-8">
              <SectionTitle id="faq" title={t.faq.title} />
              <div className="flex flex-col gap-3">
                {t.faq.items.map((f) => (
                  <details key={f.q} className="group rounded-card bg-surface open:shadow-hard border-[length:var(--bw)] border-line">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-card p-4 text-lg font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                      <span>{nb(f.q)}</span>
                      <span className="grid size-8 shrink-0 place-items-center rounded-card bg-violet-soft text-violet-strong transition-transform duration-500 ease-base group-open:rotate-180 border-[length:var(--bw)] border-line">
                        <Icon name="chevron" className="size-5" />
                      </span>
                    </summary>
                    <p className="px-4 pb-4 text-muted">{nb(f.a)}</p>
                  </details>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal>
            <section
              aria-labelledby="final"
              className="theme-light on-violet flex flex-col items-start gap-6 rounded-card bg-violet p-8 text-white sm:p-12 border-[length:var(--bw)] border-line"
            >
              <h2 id="final" className="max-w-[680px] text-3xl font-bold sm:text-4xl">
                {nb(t.final.title)}
              </h2>
              <SignupLink href="/asso/inscription" className={ctaClass}>
                {t.final.cta}
              </SignupLink>
              <a
                href="#presentation"
                className="inline-flex min-h-11 items-center rounded-card py-2 text-base font-semibold underline underline-offset-4"
              >
                {nb(t.final.lead)}
              </a>
            </section>
          </Reveal>

          <Reveal>
            <LeadForm />
          </Reveal>
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
