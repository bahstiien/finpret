import type { Metadata } from "next";
import {
  Catalogue,
  ExampleWeek,
  Examples,
  Faq,
  Features,
  FinalCta,
  Hero,
  Households,
  HowItWorks,
  Pricing,
  SiteFooter,
  SiteHeader,
  TopRecipes,
} from "@/components/landing/Landing";
import { JsonLd } from "@/components/associations/JsonLd";
import { fr } from "@/i18n/fr";
import { homeJsonLd } from "@/seo/jsonld";

const t = fr.landing;

export const metadata: Metadata = {
  title: { absolute: t.metaTitle },
  description: t.metaDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: t.metaTitle,
    description: t.metaDescription,
    url: "/",
    siteName: "Fin Prêt",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Logo Fin Prêt" }],
  },
  twitter: { card: "summary", title: t.metaTitle, description: t.metaDescription },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={homeJsonLd(t.metaDescription)} />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-r2 focus:bg-banana focus:px-4 focus:py-3 focus:font-bold focus:text-[#17151f]"
      >
        {t.skip}
      </a>
      <SiteHeader />
      <main id="contenu" className="lp-defer">
        <Hero />
        <TopRecipes />
        <ExampleWeek />
        <Catalogue />
        <HowItWorks />
        <Examples />
        <Features />
        <Households />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
