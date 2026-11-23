import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Faq, PageFrame } from "@/components/seo/Shell";
import { faqFr as t } from "@/i18n/faq";
import { breadcrumbJsonLd, faqJsonLd, type Crumb } from "@/seo/jsonld";

export const metadata: Metadata = {
  title: { absolute: t.metaTitle },
  description: t.metaDescription,
  alternates: { canonical: "/faq" },
  openGraph: {
    title: t.metaTitle,
    description: t.metaDescription,
    url: "/faq",
    siteName: "Fin Prêt",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Logo Fin Prêt" }],
  },
  twitter: { card: "summary", title: t.metaTitle, description: t.metaDescription },
};

const crumbs: Crumb[] = [
  { name: "Accueil", path: "/" },
  { name: t.title, path: "/faq" },
];

export default function FaqPage() {
  return (
    <PageFrame>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={faqJsonLd(t.sections.flatMap((s) => s.items))} />
      <Breadcrumbs crumbs={crumbs} />
      <header className="flex flex-col gap-4">
        <h1 className="t-hero" style={{ fontSize: "clamp(40px, 7vw, 88px)" }}>
          {t.title}
        </h1>
        <p className="t-body max-w-[640px] text-[19px]">{t.lead}</p>
        <nav aria-label={t.toc} className="flex flex-wrap gap-x-5 gap-y-2">
          {t.sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="lnk t-small inline-flex min-h-11 items-center">
              {s.title}
            </a>
          ))}
        </nav>
      </header>
      {t.sections.map((s) => (
        <Faq key={s.id} id={s.id} title={s.title} items={s.items} />
      ))}
      <p className="t-body">
        <Link href="/contact" className="lnk">
          {t.contact}
        </Link>
      </p>
    </PageFrame>
  );
}
