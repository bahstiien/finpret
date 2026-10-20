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
    <section className="theme-light rounded-b-sheet bg-violet text-white">
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
              href="/associations"
              className="hidden min-h-11 items-center rounded-pill px-4 text-base font-bold hover:bg-white/15 md:inline-flex"
            >
              Associations
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-pill border-2 border-white/70 px-5 text-base font-bold hover:bg-white/15"
            >
              {t.nav.login}
            </Link>
          </nav>
        </header>

        <div className="grid items-center gap-10 pt-6 pb-14 sm:pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:pb-20">
          <div className="flex flex-col items-start gap-6">
            <span className="rounded-pill bg-black/25 px-4 py-1.5 text-sm font-bold">{h.eyebrow}</span>
            <h1 className="text-[44px] leading-[1.02] font-black tracking-[-0.02em] sm:text-6xl lg:text-7xl">
              {nb(h.titleLine1)} <span className="text-banana block">{nb(h.titleLine2)}</span>
            </h1>
            <p className="max-w-xl text-lg font-bold">{nb(h.lead)}</p>
            <div className="flex flex-col items-stretch gap-3 self-stretch sm:flex-row sm:items-center sm:self-start">
              <CtaLink>{nb(h.cta)}</CtaLink>
              <a
                href="#comment"
                className="inline-flex min-h-[52px] items-center justify-center rounded-pill border-2 border-white/70 px-6 text-base font-bold hover:bg-white/15"
              >
                {h.secondary}
              </a>
            </div>
            <p className="flex items-center gap-2 text-[15px] font-bold">
              <Icon name="check" className="size-5 text-banana" />
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
                className="theme-light absolute top-44 -left-52 hidden w-64 items-start gap-3 rounded-[22px] bg-nav p-3.5 text-on-nav shadow-float xl:flex"
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
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
