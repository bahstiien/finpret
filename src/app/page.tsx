import type { Metadata } from "next";
import { Audiences } from "@/components/landing/Audiences";
import { Benefits } from "@/components/landing/Benefits";
import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Proof } from "@/components/landing/Proof";
import { Showcase } from "@/components/landing/Showcase";
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
      <Hero />
      <main id="contenu">
        <Proof />
        <Benefits />
        <HowItWorks />
        <Showcase />
        <Features />
        <Audiences />
        <Faq />
      </main>
      <FinalCta />
    </>
  );
}
