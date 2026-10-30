import Link from "next/link";
import { landingV2 as t } from "@/i18n/landing";
import { Icon, type IconName } from "./Icon";

/** Landing (maquette v2.1) : sections bordées, aplats par domaine, ombres dures. */

const wrap = "mx-auto w-full max-w-[1240px] px-4 min-[900px]:px-10";
const sectionPad = "flex flex-col gap-7 py-14";

function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Fin Prêt, accueil">
      <span className="logo-mark" aria-hidden="true">
        <Icon name="pot" className="ic" />
      </span>
      Fin Prêt
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b-[length:var(--bw)] border-line bg-surface">
      <div className={`${wrap} flex items-center justify-between gap-4 !py-3`}>
        <Logo />
        <nav aria-label={t.nav.label} className="hidden gap-1 min-[900px]:flex">
          {[
            ["#comment", t.nav.how],
            ["#fonctions", t.nav.features],
            ["#foyers", t.nav.households],
            ["#tarifs", t.nav.pricing],
          ].map(([href, label]) => (
            <a key={href} href={href} className="btn btn--ghost btn--sm">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn--ghost btn--sm hidden min-[900px]:inline-flex">
            {t.nav.login}
          </Link>
          <Link href="/login" className="btn btn--primary btn--sm">
            {t.nav.start}
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroCollage() {
  const h = t.hero;
  return (
    <div aria-hidden="true" className="relative hidden min-h-[430px] min-[900px]:block">
      <div className="card tone-menu tilt-l absolute top-2.5 left-0 flex w-[260px] flex-col gap-2">
        <p className="t-kicker">{h.menuCard.kicker}</p>
        <p className="t-3">{h.menuCard.title}</p>
        <div className="flex items-center gap-2">
          <span className="t-small font-bold">{h.menuCard.country}</span>
          <span className="pill mono">{h.menuCard.time}</span>
        </div>
      </div>
      <div className="card tone-session tilt-2 absolute top-[118px] right-0 flex w-[230px] flex-col items-center gap-1 text-center">
        <p className="t-kicker">{h.sessionCard.kicker}</p>
        <p className="mono text-[64px] leading-none font-bold">{h.sessionCard.time}</p>
        <p className="t-small font-bold">{h.sessionCard.caption}</p>
      </div>
      <div className="card tone-courses absolute top-[262px] left-4 flex w-[270px] flex-col gap-2">
        <p className="t-kicker">{h.coursesCard.kicker}</p>
        <div className="bento grid-cols-3">
          {[
            [h.coursesCard.need, h.coursesCard.grams, ""],
            [h.coursesCard.bought, h.coursesCard.grams, ""],
            [h.coursesCard.left, h.coursesCard.zero, "tone-success"],
          ].map(([label, value, tone]) => (
            <span key={label} className={`px-2 py-1 ${tone}`}>
              <span className="t-kicker block !text-[10px]">{label}</span>
              <span className="mono t-small font-bold">{value}</span>
            </span>
          ))}
        </div>
      </div>
      <span className="stamp tone-banane absolute right-7 bottom-0">
        <span className="stamp-name">{h.stamp}</span>
      </span>
    </div>
  );
}

export function Hero() {
  const h = t.hero;
  return (
    <section aria-labelledby="hero-t" className="border-b-[length:var(--bw)] border-line">
      <div className={`${wrap} flex flex-col gap-8 pt-10 pb-14`}>
        <span className="sticker tone-banane self-start">{h.sticker}</span>
        <h1 id="hero-t" className="t-hero" style={{ fontSize: "clamp(44px, 8.2vw, 124px)" }}>
          {h.titlePlain}{" "}
          <span className="bg-violet px-[0.12em] text-white [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
            {h.titleMark}
          </span>
        </h1>
        <div className="grid items-center gap-8 min-[900px]:grid-cols-2 min-[900px]:gap-6">
          <div className="flex flex-col gap-6">
            <p className="max-w-[620px] text-xl leading-[1.45]">{h.lead}</p>
            <div className="flex flex-wrap gap-3.5">
              <Link href="/login" className="btn btn--primary btn--lg">
                {h.cta}
                <Icon name="arrow" className="ic" />
              </Link>
              <a href="#comment" className="btn btn--outline btn--lg">
                {h.secondary}
              </a>
            </div>
          </div>
          <HeroCollage />
        </div>
      </div>
    </section>
  );
}

export function Catalogue() {
  const c = t.catalogue;
  return (
    <section aria-label={c.label} className="tone-dark border-b-[length:var(--bw)] border-line">
      <div
        className={`${wrap} grid gap-[var(--bw)] !px-0 bg-on-nav [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]`}
      >
        {c.items.map((i) => (
          <div key={i.label} className="tone-dark flex items-baseline gap-3 p-6">
            <span className="mono text-[56px] leading-none font-bold text-banana">{i.n}</span>
            <span className="t-ui">{i.label}</span>
          </div>
        ))}
        <div className="tone-dark flex items-center gap-3 p-6">
          <Icon name="sparkle" className="ic" />
          <span className="t-ui">{c.season}</span>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ n, id, title }: { n: string; id: string; title: string }) {
  return (
    <div className="sh">
      <span className="sh-tag">{n}</span>
      <h2 id={id} className="t-1">
        {title}
      </h2>
      <span className="rule" />
    </div>
  );
}

export function HowItWorks() {
  const tones = ["", "", "tone-session", "tone-cta"];
  return (
    <section id="comment" aria-labelledby="cm-t">
      <div className={`${wrap} ${sectionPad}`}>
        <SectionHead n="01" id="cm-t" title={t.how.title} />
        <ol
          className="bento shadow-[var(--sh-lg)] [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]"
        >
          {t.how.steps.map((s, i) => (
            <li key={s.n} className={`flex flex-col gap-3 p-6 ${tones[i]}`}>
              <span className="t-hero text-[72px] !leading-[0.8]">{s.n}</span>
              <p className="t-2">{s.title}</p>
              <p className="t-body">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section
      id="fonctions"
      aria-labelledby="fn-t"
      className="border-t-[length:var(--bw)] border-line bg-surface"
    >
      <div className={`${wrap} ${sectionPad}`}>
        <SectionHead n="02" id="fn-t" title={t.features.title} />
        <div className="grid gap-4 min-[900px]:grid-cols-3 min-[900px]:gap-6">
          {t.features.items.map((f) => (
            <div key={f.title} className={`card flex flex-col gap-2.5 ${f.tone ? `tone-${f.tone}` : ""}`}>
              <Icon name={f.icon as IconName} className="ic-xl" />
              <h3 className="t-2">{f.title}</h3>
              <p className="t-body">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Households() {
  return (
    <section id="foyers" aria-labelledby="fy-t" className="border-t-[length:var(--bw)] border-line">
      <div className={`${wrap} ${sectionPad}`}>
        <SectionHead n="03" id="fy-t" title={t.households.title} />
        <div className="grid gap-4 min-[900px]:grid-cols-4 min-[900px]:gap-6">
          {t.households.items.map((h) => (
            <article key={h.tag} className="card flex flex-col gap-2.5">
              <span className={`sticker tone-${h.tone} self-start ${h.tilt ? "!rotate-2" : ""}`}>{h.tag}</span>
              <h3 className="t-3">{h.title}</h3>
              <p className="t-small">{h.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  const p = t.pricing;
  return (
    <section
      id="tarifs"
      aria-labelledby="px-t"
      className="border-t-[length:var(--bw)] border-line bg-surface"
    >
      <div className={`${wrap} ${sectionPad}`}>
        <SectionHead n="04" id="px-t" title={p.title} />
        <p className="max-w-[680px] text-lg leading-[1.45]">{p.lead}</p>
        <div className="grid max-w-[960px] items-stretch gap-4 min-[900px]:grid-cols-2 min-[900px]:gap-6">
          <article className="card flex flex-col gap-4" aria-labelledby="px-m">
            <h3 id="px-m" className="t-label">
              {p.monthly.label}
            </h3>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="num-xl !text-[64px]">{p.monthly.price}</span>
              <span className="t-ui">{p.monthly.per}</span>
            </p>
            <p className="t-small muted">{p.monthly.note}</p>
            <Link href="/login" className="btn btn--outline btn--lg btn--block mt-auto">
              {p.monthly.cta}
            </Link>
          </article>
          <article
            className="card relative flex flex-col gap-4 [box-shadow:var(--sh-violet)]"
            aria-labelledby="px-a"
          >
            <span className="sticker tone-banane absolute -top-4 right-4 !rotate-3">{p.yearly.badge}</span>
            <h3
              id="px-a"
              className="t-label tone-violet self-start border-[length:var(--bw)] border-line px-2 py-1"
            >
              {p.yearly.label}
            </h3>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="num-xl !text-[64px]">{p.yearly.price}</span>
              <span className="t-ui">{p.yearly.per}</span>
            </p>
            <p className="t-small font-bold">{p.yearly.note}</p>
            <Link href="/login" className="btn btn--primary btn--lg btn--block mt-auto">
              {p.yearly.cta}
            </Link>
          </article>
        </div>
        <div className="nb tone-menu flex max-w-[960px] flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex max-w-[560px] flex-col gap-1.5">
            <p className="t-kicker">{p.asso.kicker}</p>
            <p className="t-ui text-lg">{p.asso.text}</p>
          </div>
          <Link href="/associations" className="btn btn--outline !bg-surface !text-ink">
            {p.asso.cta}
            <Icon name="arrow" className="ic" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section aria-labelledby="fq-t" className="border-t-[length:var(--bw)] border-line">
      <div className={`${wrap} flex max-w-[1000px] flex-col gap-5 py-14`}>
        <SectionHead n="05" id="fq-t" title={t.faq.title} />
        {t.faq.items.map((f, i) => (
          <details key={f.q} className="faq" open={i === 0}>
            <summary>
              {f.q}
              <Icon name="chevron" className="ic" />
            </summary>
            <div className="faq-body">{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="ct-t" className="tone-cta border-t-[length:var(--bw)] border-line">
      <div className={`${wrap} flex flex-col items-start gap-5 py-14`}>
        <h2 id="ct-t" className="t-hero" style={{ fontSize: "clamp(44px, 7vw, 104px)" }}>
          {t.finalCta.title}
        </h2>
        <Link href="/login" className="btn btn--dark btn--lg">
          {t.finalCta.cta}
          <Icon name="arrow" className="ic" />
        </Link>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const f = t.footer;
  return (
    <footer className="border-t-[length:var(--bw)] border-line bg-surface">
      <div className={`${wrap} flex flex-col gap-5 py-8`}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Logo />
          <nav aria-label={f.nav} className="flex flex-wrap gap-x-5 gap-y-2">
            {f.links.map((l) => (
              <Link key={l.href} href={l.href} className="lnk t-small">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t-[length:var(--bw)] border-line pt-4">
          <p className="mono t-small font-bold">finpret.app</p>
          <nav aria-label={f.legal} className="flex flex-wrap gap-x-4 gap-y-2">
            {f.legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="lnk t-small">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
