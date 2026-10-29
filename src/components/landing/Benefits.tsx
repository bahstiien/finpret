import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Icon, type IconName } from "./Icon";
import { Container, SectionTitle } from "./Section";

/** Une couleur par domaine : menu en violet, session en bleu, courses en rose. */
const tones: { card: string; kicker: string; icon: IconName }[] = [
  { card: "bg-violet-soft", kicker: "text-violet-strong", icon: "utensils" },
  { card: "bg-blue-soft", kicker: "text-blue-ink", icon: "timer" },
  { card: "bg-pink-soft", kicker: "text-pink-ink", icon: "basket" },
];

export function Benefits() {
  const b = fr.landing.benefits;
  return (
    <section aria-labelledby="benefices" className="pb-16 sm:pb-24">
      <Container className="flex flex-col gap-8 sm:gap-10">
        <SectionTitle id="benefices" title={b.title} />
        <ul className="grid gap-3 lg:grid-cols-3">
          {tones.map((tone, i) => {
            const item = b.items[i];
            if (!item) return null;
            return (
              <li key={item.title} className={`flex flex-col gap-4 rounded-card p-6 sm:p-8 ${tone.card}`}>
                <span className="grid size-12 place-items-center rounded-card bg-surface text-ink border-[length:var(--bw)] border-line">
                  <Icon name={tone.icon} className="size-6" />
                </span>
                <p className={`text-sm font-bold tracking-wider uppercase ${tone.kicker}`}>
                  {item.kicker}
                </p>
                <h3 className="text-2xl leading-tight font-bold">{nb(item.title)}</h3>
                <p className="text-lg leading-snug font-bold">{nb(item.quote)}</p>
                <p className="text-base">{nb(item.text)}</p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
