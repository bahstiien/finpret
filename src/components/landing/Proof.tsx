import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Container } from "./Section";

export function Proof() {
  const p = fr.landing.proof;
  return (
    <section aria-label="Fin Prêt en chiffres" className="py-12 sm:py-16">
      <Container className="flex flex-col gap-8">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {p.stats.map((s) => (
            <li key={s.label} className="flex flex-col gap-1">
              <span className="font-display text-5xl leading-none font-bold tracking-tight text-violet sm:text-6xl">
                {nb(s.value)}
              </span>
              <span className="text-base font-semibold text-muted">{s.label}</span>
            </li>
          ))}
        </ul>
        <p className="max-w-xl text-base font-semibold">{nb(p.origin)}</p>
      </Container>
    </section>
  );
}
