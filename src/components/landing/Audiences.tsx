import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Container, SectionTitle } from "./Section";
import { Card } from "@/components/ui/Card";

export function Audiences() {
  const a = fr.landing.audiences;
  return (
    <section aria-labelledby="pour-qui" className="pb-16 sm:pb-24">
      <Container className="flex flex-col gap-8 sm:gap-10">
        <SectionTitle id="pour-qui" title={a.title} />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {a.items.map((item) => (
            <Card as="li" key={item.label} className="flex flex-col gap-3">
              <span className="self-start rounded-pill bg-violet-soft px-3 py-1 text-sm font-bold text-violet-strong">
                {item.label}
              </span>
              <p className="text-base">{nb(item.text)}</p>
            </Card>
          ))}
        </ul>
      </Container>
    </section>
  );
}
