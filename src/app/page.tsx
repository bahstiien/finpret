import type { Metadata } from "next";
import {
  Catalogue,
  Faq,
  Features,
  FinalCta,
  Hero,
  Households,
  HowItWorks,
  Pricing,
  SiteFooter,
  SiteHeader,
} from "@/components/landing/Landing";
import { fr } from "@/i18n/fr";

const t = fr.landing;

export const metadata: Metadata = {
  title: { absolute: t.metaTitle },
  description: t.metaDescription,
  openGraph: { title: t.metaTitle, description: t.metaDescription, locale: "fr_FR", type: "website" },
};

export default function HomePage() {
  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-r2 focus:bg-banana focus:px-4 focus:py-3 focus:font-bold focus:text-[#17151f]"
      >
        {t.skip}
      </a>
      <SiteHeader />
      <main id="contenu">
        <Hero />
        <Catalogue />
        <HowItWorks />
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
