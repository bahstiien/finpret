import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Icon } from "./Icon";
import { Container, SectionTitle } from "./Section";

const tones = {
  pink: "bg-pink-soft",
  green: "bg-green-soft",
  cream: "bg-yellow-soft",
  blue: "bg-blue-soft",
  violet: "bg-violet-soft",
  surface: "bg-surface",
} as const;

export function Features() {
  const f = fr.landing.features;
  return (
    <section id="fonctions" aria-labelledby="fonctions-titre" className="scroll-mt-4 pb-16 sm:pb-24">
      <Container className="flex flex-col gap-8 sm:gap-10">
        <SectionTitle id="fonctions-titre" title={f.title} lead={f.lead} />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {f.items.map((item) => (
            <li key={item.title} className={`flex flex-col gap-3 rounded-card p-6 ${tones[item.tone]}`}>
              <span className="grid size-11 place-items-center rounded-[14px] bg-surface text-ink">
                <Icon name={item.icon} className="size-6" />
              </span>
              <h3 className="text-xl leading-tight font-bold">{nb(item.title)}</h3>
              <p className="text-base">{nb(item.text)}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
