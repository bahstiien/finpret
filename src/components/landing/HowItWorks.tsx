import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Container, SectionTitle } from "./Section";
import { Card } from "@/components/ui/Card";

export function HowItWorks() {
  const h = fr.landing.how;
  return (
    <section id="comment" aria-labelledby="comment-titre" className="scroll-mt-4 pb-16 sm:pb-24">
      <Container className="flex flex-col gap-8 sm:gap-10">
        <SectionTitle id="comment-titre" title={h.title} lead={h.lead} />
        <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {h.steps.map((step, i) => (
            <Card as="li" key={step.title} className="flex flex-col gap-3">
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-full bg-violet font-display text-xl font-extrabold text-white"
              >
                {i + 1}
              </span>
              <h3 className="text-xl leading-tight font-bold">
                <span className="sr-only">Étape {i + 1} : </span>
                {nb(step.title)}
              </h3>
              <p className="text-base text-muted">{nb(step.text)}</p>
            </Card>
          ))}
        </ol>
      </Container>
    </section>
  );
}
