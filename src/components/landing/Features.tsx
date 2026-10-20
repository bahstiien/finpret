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

/** Grille bento : la première fonction (partage en famille) occupe une grande tuile violette. */
export function Features() {
  const f = fr.landing.features;
  const [lead, ...rest] = f.items;
  return (
    <section id="fonctions" aria-labelledby="fonctions-titre" className="scroll-mt-4 pb-16 sm:pb-24">
      <Container className="flex flex-col gap-8 sm:gap-10">
        <SectionTitle id="fonctions-titre" title={f.title} lead={f.lead} />
        <ul className="grid gap-3 md:grid-cols-3">
          {lead && (
            <li className="theme-light relative flex flex-col justify-end gap-4 overflow-hidden rounded-card bg-violet p-6 text-white sm:p-8 md:col-span-2 md:row-span-2 md:min-h-[360px]">
              <span aria-hidden="true" className="absolute -top-16 -right-16 size-64 rounded-full bg-white/15 blur-2xl" />
              <span aria-hidden="true" className="absolute -bottom-20 left-1/3 size-56 rounded-full bg-banana/30 blur-3xl" />
              <span className="relative grid size-14 place-items-center rounded-[16px] bg-banana text-[#17151f]">
                <Icon name={lead.icon} className="size-7" />
              </span>
              <h3 className="relative max-w-md text-3xl leading-tight font-black sm:text-4xl">{nb(lead.title)}</h3>
              <p className="relative max-w-md text-lg font-bold">{nb(lead.text)}</p>
            </li>
          )}
          {rest.map((item) => (
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
