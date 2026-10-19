import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Phone } from "./Phone";
import { Container, SectionTitle } from "./Section";
import { SessionScreen, ShoppingScreen, WeekScreen } from "./screens";

const cards = [
  { tone: "bg-violet-soft", kicker: "text-violet-strong", Screen: WeekScreen },
  { tone: "bg-pink-soft", kicker: "text-pink-ink", Screen: ShoppingScreen },
  { tone: "bg-blue-soft", kicker: "text-blue-ink", Screen: SessionScreen },
];

export function Showcase() {
  const s = fr.landing.showcase;
  return (
    <section aria-labelledby="captures" className="pb-16 sm:pb-24">
      <Container className="flex flex-col gap-8 sm:gap-10">
        <SectionTitle id="captures" title={s.title} />
        <ul className="grid gap-3 lg:grid-cols-3">
          {cards.map(({ tone, kicker, Screen }, i) => {
            const item = s.items[i];
            if (!item) return null;
            return (
              <li
                key={item.title}
                className={`flex flex-col gap-6 overflow-hidden rounded-card pt-6 sm:pt-8 ${tone}`}
              >
                <div className="flex flex-col gap-2 px-6 sm:px-8">
                  <p className={`text-sm font-bold tracking-[0.06em] uppercase ${kicker}`}>{item.kicker}</p>
                  <h3 className="text-2xl leading-tight font-extrabold">{nb(item.title)}</h3>
                  <p className="text-base">{nb(item.text)}</p>
                </div>
                <div className="mt-auto flex h-[400px] justify-center overflow-hidden">
                  <Phone label={nb(item.label)} height="h-[600px]" className="rounded-b-none">
                    <Screen />
                  </Phone>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
