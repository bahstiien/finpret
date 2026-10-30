import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { LeadForm } from "@/components/associations/LeadForm";
import { PublicFooter, PublicHeader } from "@/components/associations/PublicShell";
import { Simulator } from "@/components/associations/Simulator";
import { SignupLink, Track } from "@/components/associations/Track";
import { Icon } from "@/components/landing/Icon";
import { associationsFr, SITE_URL } from "@/i18n/associations";
import { nb } from "@/lib/typography";

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

// Teintes des tuiles « familles » : décoratives, elles reviennent en boucle ; l'icône vient des textes.
const tileTones = ["tone-blue", "tone-peach", "tone-pink", "tone-green"] as const;

const wrap = "mx-auto w-full max-w-[1240px] px-4 min-[900px]:px-10";

function SectionHead({ n, id, title }: { n: string; id: string; title: string }) {
  return (
    <div className="sh">
      <span className="sh-tag">{n}</span>
      <h2 id={id} className="t-1">
        {nb(title)}
      </h2>
      <span className="rule" />
    </div>
  );
}

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
        <section className="border-b-[length:var(--bw)] border-line">
          <div className={`${wrap} grid items-center gap-10 pt-10 pb-14 min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]`}>
            <div className="flex flex-col items-start gap-6">
              <span className="sticker tone-banane">{t.breadcrumbs.associations}</span>
              <h1 className="t-1 !text-[clamp(36px,5.2vw,72px)]">
                {nb(titleHead)}
                {titleTail ? (
                  <>
                    ,{" "}
                    <span className="bg-violet px-[0.12em] text-white [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
                      sans {nb(titleTail)}
                    </span>
                  </>
                ) : null}
              </h1>
              <p className="max-w-[620px] text-xl leading-[1.45]">{nb(t.hero.lead)}</p>
              <div className="flex flex-wrap gap-3.5">
                <SignupLink href="/asso/inscription" className="btn btn--primary btn--lg">
                  {t.hero.cta}
                  <Icon name="arrow" className="ic" />
                </SignupLink>
                <a href="#comment" className="btn btn--outline btn--lg">
                  {t.hero.secondary}
                </a>
              </div>
              <ul className="flex flex-wrap gap-2">
                {t.hero.proofs.map((p) => (
                  <li key={p} className="pill tone-green">
                    <Icon name="check" className="ic" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div role="img" aria-label={t.hero.visualAlt} className="relative flex min-h-[360px] flex-col gap-4 min-[900px]:min-h-[420px]">
              <p className="t-kicker">{t.hero.today}</p>
              <div className="card tone-surface tilt-l w-full max-w-[320px]">
                <p className="t-kicker">{t.hero.cantine}</p>
                <p className="t-3 mt-1">Poulet rôti, riz</p>
              </div>
              <div className="callout tone-alerte tilt-2 w-full max-w-[360px] self-end">
                <span className="callout-ic">
                  <Icon name="check" className="ic" />
                </span>
                <p className="t-small font-bold">{t.hero.alert}</p>
              </div>
              <div className="card tone-menu w-full max-w-[300px]">
                <p className="t-kicker">Ce soir</p>
                <p className="t-3">Gratin de courge</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="probleme">
          <div className={`${wrap} flex flex-col gap-7 py-14`}>
            <SectionHead n="01" id="probleme" title={t.problem.title} />
            <ul className="grid gap-4 min-[900px]:grid-cols-3 min-[900px]:gap-6">
              {t.problem.cards.map((c) => (
                <li key={c} className="card flex items-start gap-3">
                  <span className="avatar tone-pink">
                    <Icon name="close" className="ic" />
                  </span>
                  <span className="t-3">{nb(c)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="comment"
          className="border-t-[length:var(--bw)] border-line bg-surface"
        >
          <div className={`${wrap} flex flex-col gap-7 py-14`}>
            <SectionHead n="02" id="comment" title={t.how.title} />
            <ol className="bento shadow-[var(--sh-lg)] [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
              {t.how.steps.map((s, i) => (
                <li
                  key={s.text}
                  className={`flex flex-col gap-3 p-6 ${i === 2 ? "tone-session" : i === 3 ? "tone-cta" : ""}`}
                >
                  <span className="t-hero text-[72px] !leading-[0.8]">{String(i + 1).padStart(2, "0")}</span>
                  <Icon name={s.icon} className="ic-lg" />
                  <p className="t-3">{nb(s.text)}</p>
                </li>
              ))}
            </ol>
            <Link href="/associations/comment-ca-marche" className="btn btn--outline btn--sm self-start">
              {t.footer.howItWorks}
              <Icon name="arrow" className="ic" />
            </Link>
          </div>
        </section>

        <section aria-labelledby="familles" className="border-t-[length:var(--bw)] border-line">
          <div className={`${wrap} flex flex-col gap-7 py-14`}>
            <SectionHead n="03" id="familles" title={t.families.title} />
            <ul className="grid gap-4 min-[900px]:grid-cols-4 min-[900px]:gap-6">
              {t.families.items.map((c, i) => (
                <li key={c.text} className={`card flex flex-col justify-between gap-6 ${tileTones[i % tileTones.length]}`}>
                  <Icon name={c.icon} className="ic-xl" />
                  <span className="t-3">{nb(c.text)}</span>
                </li>
              ))}
              <li className="card tone-banane t-3 min-[900px]:col-span-4">{nb(t.families.benefit)}</li>
            </ul>
          </div>
        </section>

        <section className="tone-dark border-y-[length:var(--bw)] border-line">
          <div className={`${wrap} py-14`}>
            <p className="t-1 max-w-[900px] !text-[clamp(30px,4.4vw,56px)]">{nb(t.tagline)}</p>
          </div>
        </section>

        <section aria-labelledby="simulateur">
          <div className={`${wrap} flex flex-col gap-7 py-14`}>
            <SectionHead n="04" id="simulateur" title={t.simulator.title} />
            <Simulator />
          </div>
        </section>

        <section aria-labelledby="zero" className="border-t-[length:var(--bw)] border-line bg-surface">
          <div className={`${wrap} flex flex-col gap-7 py-14`}>
            <SectionHead n="05" id="zero" title={t.zero.title} />
            <ul className="grid gap-4 sm:grid-cols-2 min-[900px]:grid-cols-4 min-[900px]:gap-6">
              {t.zero.items.map((c) => (
                <li key={c} className="card tone-green flex items-center gap-3">
                  <Icon name="check" className="ic" />
                  <span className="t-ui">{nb(c)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="confiance" className="border-t-[length:var(--bw)] border-line">
          <div className={`${wrap} flex flex-col gap-7 py-14`}>
            <SectionHead n="06" id="confiance" title={t.trust.title} />
            <ul className="grid gap-4 min-[900px]:grid-cols-2 min-[900px]:gap-6">
              {t.trust.items.map((c, i) => (
                <li key={c} className={`card flex items-start gap-3 ${i === 0 ? "min-[900px]:col-span-2" : ""}`}>
                  <Icon name="shield" className="ic" />
                  <span className="t-body">{nb(c)}</span>
                </li>
              ))}
            </ul>
            {t.testimonial.quote && (
              <figure className="card tone-banane">
                <blockquote className="t-2">{nb(t.testimonial.quote)}</blockquote>
                <figcaption className="t-small mt-3">{t.testimonial.author}</figcaption>
              </figure>
            )}
          </div>
        </section>

        <section aria-labelledby="faq" className="border-t-[length:var(--bw)] border-line bg-surface">
          <div className={`${wrap} flex max-w-[1000px] flex-col gap-5 py-14`}>
            <SectionHead n="07" id="faq" title={t.faq.title} />
            {t.faq.items.map((f, i) => (
              <details key={f.q} className="faq" open={i === 0}>
                <summary>
                  {nb(f.q)}
                  <Icon name="chevron" className="ic" />
                </summary>
                <div className="faq-body">{nb(f.a)}</div>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="final" className="tone-violet border-t-[length:var(--bw)] border-line">
          <div className={`${wrap} flex flex-col items-start gap-5 py-14`}>
            <h2 id="final" className="t-hero max-w-[900px] !text-[clamp(40px,6vw,88px)]">
              {nb(t.final.title)}
            </h2>
            <SignupLink href="/asso/inscription" className="btn btn--primary btn--lg">
              {t.final.cta}
              <Icon name="arrow" className="ic" />
            </SignupLink>
            <a href="#presentation" className="lnk t-ui">
              {nb(t.final.lead)}
            </a>
          </div>
        </section>

        <div className={`${wrap} py-14`}>
          <LeadForm />
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
