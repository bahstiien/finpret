import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Icon } from "./Icon";
import { Container, SectionTitle } from "./Section";

export function Faq() {
  const f = fr.landing.faq;
  return (
    <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-4 pb-16 sm:pb-24">
      <Container className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionTitle id="faq-titre" title={f.title} />
        <div className="flex flex-col gap-2">
          {f.items.map((item) => (
            <details key={item.q} name="faq" className="group rounded-card bg-surface">
              <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 rounded-card px-6 py-4 text-base font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                {nb(item.q)}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-chip transition-transform duration-150 group-open:rotate-180">
                  <Icon name="chevron" className="size-5" />
                </span>
              </summary>
              <p className="px-6 pb-5 text-base text-muted">{nb(item.a)}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
