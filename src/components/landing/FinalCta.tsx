import Image from "next/image";
import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Container, CtaLink } from "./Section";

/** Bandeau final violet et pied de page : le logo inversé se pose sur le violet de marque. */
export function FinalCta() {
  const c = fr.landing.finalCta;
  const f = fr.landing.footer;
  return (
    <section className="theme-light rounded-t-sheet bg-violet text-white">
      <Container className="flex flex-col items-center gap-6 pt-16 pb-12 text-center sm:pt-24">
        <h2 className="text-[40px] leading-[1.05] font-black tracking-[-0.02em] sm:text-6xl">
          {nb(c.title)}
        </h2>
        <p className="max-w-xl text-lg font-bold">{nb(c.text)}</p>
        <CtaLink>{nb(c.cta)}</CtaLink>
      </Container>
      <Container>
        <footer className="flex flex-col items-center justify-between gap-4 border-t border-white/25 py-6 text-base font-bold sm:flex-row">
          <Image
            src="/brand/finpret-logo-inverse.png"
            alt="Fin Prêt"
            width={1040}
            height={300}
            className="h-10 w-auto"
          />
          <p>{nb(f.signature)}</p>
          <p className="flex flex-col items-center gap-1 sm:items-end">
            <a
              href={`mailto:${f.contact}`}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {f.contact}
            </a>
            <span>{f.team}</span>
          </p>
        </footer>
      </Container>
    </section>
  );
}
