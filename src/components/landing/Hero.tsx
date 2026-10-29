import Image from "next/image";
import Link from "next/link";
import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Icon } from "./Icon";
import { Phone } from "./Phone";
import { MenuScreen } from "./screens";
import { Container, CtaLink } from "./Section";

export function Hero() {
  const t = fr.landing;
  const h = t.hero;
  return (
    <section className="theme-light border-b-[length:var(--bw)] border-line bg-bg text-ink">
      <Container>
        <header className="-mx-4 flex items-center justify-between gap-4 border-b-[length:var(--bw)] border-line bg-surface px-4 py-3 sm:-mx-8 sm:px-8">
          <Link href="/" aria-label="Fin Prêt, accueil" className="flex items-center gap-2 rounded-r2">
            <Image src="/brand/finpret-symbole.svg" alt="" width={36} height={36} priority className="size-9" />
            <span className="font-display text-xl uppercase">Fin Prêt</span>
          </Link>
          <nav aria-label={t.nav.label} className="flex items-center gap-1 sm:gap-2">
            {[
              { href: "#comment", label: t.nav.how },
              { href: "#fonctions", label: t.nav.features },
              { href: "#faq", label: t.nav.faq },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hidden min-h-11 items-center rounded-r2 px-4 text-base font-bold uppercase hover:bg-chip md:inline-flex"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/associations"
              className="hidden min-h-11 items-center rounded-r2 px-4 text-base font-bold uppercase hover:bg-chip md:inline-flex"
            >
              Associations
            </Link>
            <Link
              href="/login"
              className="btn-hard inline-flex min-h-11 items-center rounded-r2 border-[length:var(--bw)] border-line bg-banana px-4 text-base font-bold text-[#17151f] uppercase"
            >
              {t.nav.login}
            </Link>
          </nav>
        </header>

        <div className="grid items-center gap-10 pt-6 pb-12 sm:pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:pb-20">
          <div className="flex flex-col items-start gap-6">
            <span className="rounded-pill border-2 border-line bg-banana px-4 py-1 font-mono text-xs font-bold tracking-[0.08em] uppercase">{h.eyebrow}</span>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl">
              {nb(h.titleLine1)} <span className="block w-fit bg-violet px-2 text-white">{nb(h.titleLine2)}</span>
            </h1>
            <p className="max-w-xl text-lg font-bold">{nb(h.lead)}</p>
            <div className="flex flex-col items-stretch gap-3 self-stretch sm:flex-row sm:items-center sm:self-start">
              <CtaLink>{nb(h.cta)}</CtaLink>
              <a
                href="#comment"
                className="btn-hard inline-flex min-h-[52px] items-center justify-center rounded-r2 border-[length:var(--bw)] border-line bg-surface px-6 text-base font-bold uppercase"
              >
                {h.secondary}
              </a>
            </div>
            <p className="flex items-center gap-2 text-sm font-bold">
              <Icon name="check" className="size-5 text-green-strong" />
              {nb(h.reassurance)}
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <Phone label={nb(h.phoneLabel)}>
                <MenuScreen />
              </Phone>
              <aside
                aria-label="Exemple de notification"
                className="theme-light absolute top-24 -left-52 hidden w-64 items-start gap-3 rounded-card bg-nav p-3 text-on-nav shadow-hard xl:flex border-[length:var(--bw)] border-line"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-card bg-banana text-[#17151f] border-[length:var(--bw)] border-line">
                  <Icon name="pot" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold opacity-80">{nb(h.notification.time)}</p>
                  <p className="text-sm leading-tight font-bold">{nb(h.notification.title)}</p>
                  <p className="mt-0.5 text-xs leading-snug">{nb(h.notification.text)}</p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
