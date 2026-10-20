import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { fr } from "@/i18n/fr";
import { nb } from "@/lib/typography";
import { Icon } from "./Icon";
import { Phone } from "./Phone";
import { MenuScreen } from "./screens";
import { Container, CtaLink } from "./Section";

const delay = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties;

/** Hero centré : titre et actions, puis un panneau encadré où le téléphone émerge du bas. */
export function Hero() {
  const t = fr.landing;
  const h = t.hero;
  const [duration, meals] = t.proof.stats;
  return (
    <section className="theme-light overflow-hidden rounded-b-sheet bg-violet text-white">
      <Container>
        <header className="flex items-center justify-between gap-4 py-4 sm:py-6">
          <Link href="/" aria-label="Fin Prêt, accueil" className="rounded-pill">
            <Image
              src="/brand/finpret-logo-inverse.png"
              alt="Fin Prêt"
              width={1040}
              height={300}
              priority
              className="h-11 w-auto"
            />
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
                className="hidden min-h-11 items-center rounded-pill px-4 text-base font-bold hover:bg-white/15 md:inline-flex"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-pill border-2 border-white/70 px-5 text-base font-bold hover:bg-white/15"
            >
              {t.nav.login}
            </Link>
          </nav>
        </header>

        <div className="flex flex-col items-center gap-6 pt-8 text-center sm:pt-12">
          <span className="rise rounded-pill bg-white/15 px-4 py-1.5 text-sm font-bold">{h.eyebrow}</span>
          <h1
            style={delay(80)}
            className="rise max-w-4xl text-[44px] leading-[1.02] font-black tracking-[-0.02em] text-balance sm:text-6xl lg:text-7xl"
          >
            {nb(h.titleLine1)} <span className="text-banana block">{nb(h.titleLine2)}</span>
          </h1>
          <p style={delay(160)} className="rise max-w-2xl text-lg font-bold text-balance">
            {nb(h.lead)}
          </p>
          <div
            style={delay(240)}
            className="rise flex flex-col items-stretch gap-3 self-stretch sm:flex-row sm:items-center sm:self-center"
          >
            <CtaLink>{nb(h.cta)}</CtaLink>
            <a
              href="#comment"
              className="inline-flex min-h-[52px] items-center justify-center rounded-pill border-2 border-white/70 px-6 text-base font-bold hover:bg-white/15"
            >
              {h.secondary}
            </a>
          </div>
          <p style={delay(300)} className="rise flex items-center gap-2 text-[15px] font-bold">
            <Icon name="check" className="size-5 text-banana" />
            {nb(h.reassurance)}
          </p>
        </div>

        <div
          style={delay(380)}
          className="rise relative mx-auto mt-12 max-w-4xl rounded-t-[40px] bg-white/12 px-6 pt-10 sm:mt-16 sm:pt-14"
        >
          <div className="flex h-[360px] justify-center overflow-hidden sm:h-[440px]">
            <Phone label={nb(h.phoneLabel)} height="h-[640px]" className="rounded-b-none">
              <MenuScreen />
            </Phone>
          </div>

          <aside
            aria-label="Exemple de notification"
            className="theme-light absolute top-24 left-4 hidden w-64 items-start gap-3 rounded-[22px] bg-nav p-3.5 text-left text-on-nav shadow-float md:flex lg:-left-10"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-banana text-[#17151f]">
              <Icon name="pot" className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold opacity-80">{nb(h.notification.time)}</p>
              <p className="text-[15px] leading-tight font-bold">{nb(h.notification.title)}</p>
              <p className="mt-0.5 text-[13px] leading-snug">{nb(h.notification.text)}</p>
            </div>
          </aside>

          {duration && meals && (
            <ul
              aria-label="Fin Prêt en bref"
              className="theme-light absolute right-4 bottom-16 hidden flex-col gap-2 text-left md:flex lg:-right-10"
            >
              {[duration, meals].map((s) => (
                <li key={s.label} className="flex items-center gap-3 rounded-[22px] bg-banana px-5 py-3 text-[#17151f] shadow-float">
                  <span className="font-display text-3xl leading-none font-black">{nb(s.value)}</span>
                  <span className="max-w-[9rem] text-sm leading-tight font-bold">{s.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}
