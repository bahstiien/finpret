"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { RecipeImage } from "@/components/ui/RecipeImage";
import { landingV2 } from "@/i18n/landing";
import type { RecipePhoto } from "@/seo/images";

export type TopSlide = {
  slug: string;
  name: string;
  description: string | null;
  photo: RecipePhoto;
  activeMin: number | null;
  fridgeDays: number | null;
  freezable: boolean;
};

const t = landingV2.top;
/** Durée d'affichage d'un plat en défilement automatique (ms) ; la barre de progression suit la même durée. */
const DELAY = 6000;

/**
 * Carrousel « top 5 » de l'accueil (inspiration : Hero Carousel de 21st.dev, en version néo-brutaliste) :
 * la section prend la couleur du fond de la photo active, le plat arrive en tournant, une bande de vignettes
 * montre la suite. Défilement automatique en pause au survol, au focus, hors écran, avec le bouton pause ou
 * si l'utilisateur demande moins d'animations ; flèches du clavier et glisser au doigt.
 */
export function TopRecipesCarousel({ slides, total }: { slides: TopSlide[]; total: number }) {
  const n = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(true);
  const root = useRef<HTMLElement>(null);
  const startX = useRef<number | null>(null);

  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = !paused && !hold && visible && !reduced;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => go(i + 1), DELAY);
    return () => window.clearTimeout(id);
  }, [running, i, go]);

  const s = slides[i]!;
  const pills = [
    s.activeMin ? { icon: "timer" as const, text: t.active(s.activeMin) } : null,
    s.fridgeDays ? { icon: "fridge" as const, text: t.fridge(s.fridgeDays) } : null,
    s.freezable ? { icon: "snow" as const, text: t.freeze } : null,
  ].filter((p) => p !== null);

  return (
    <section
      ref={root}
      aria-labelledby="top-t"
      aria-roledescription="carrousel"
      className="top-band border-b-[length:var(--bw)] border-line"
      style={{ "--top-bg": s.photo.bg } as CSSProperties}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        else if (e.key === "ArrowLeft") go(i - 1);
      }}
    >
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-8 px-4 py-14 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:gap-12 min-[900px]:px-10">
        <div className="flex flex-col gap-5">
          <span className="sticker tone-banane self-start">{t.sticker}</span>
          <h2 id="top-t" className="t-hero" style={{ fontSize: "clamp(40px, 5.6vw, 80px)" }}>
            {t.title}
          </h2>
          <p className="max-w-[520px] text-lg leading-[1.45] font-medium">{t.lead}</p>

          <div
            className="card nb-lg flex flex-col gap-3"
            role="group"
            aria-roledescription="diapositive"
            aria-label={t.slide(i + 1, n)}
            aria-live={running ? "off" : "polite"}
          >
            <p className="mono t-kicker">
              {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </p>
            <h3 key={s.slug} className="top-name t-1">
              {s.name}
            </h3>
            {s.description && <p className="t-body">{s.description}</p>}
            {pills.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {pills.map((p) => (
                  <li key={p.text} className="pill tone-chip">
                    <Icon name={p.icon} className="ic" />
                    {p.text}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Link href={`/recettes/${s.slug}`} className="btn btn--primary">
                {t.see}
                <Icon name="arrowRight" className="ic" />
              </Link>
              <span className="ml-auto flex gap-2">
                <button type="button" className="iconbtn" aria-label={t.prev} onClick={() => go(i - 1)}>
                  <Icon name="arrowBack" />
                </button>
                <button type="button" className="iconbtn" aria-label={t.next} onClick={() => go(i + 1)}>
                  <Icon name="arrowRight" />
                </button>
                {!reduced && (
                  <button
                    type="button"
                    className="iconbtn"
                    aria-label={paused ? t.play : t.pause}
                    aria-pressed={paused}
                    onClick={() => setPaused(!paused)}
                  >
                    {paused ? <PlayGlyph /> : <Icon name="pause" />}
                  </button>
                )}
              </span>
            </div>
          </div>
          <Link href="/recettes" className="lnk t-ui self-start">
            {t.all(total)}
          </Link>
        </div>

        <div className="flex min-w-0 flex-col gap-5 max-[899px]:order-first">
          <div
            className="top-stage relative aspect-[4/3] touch-pan-y select-none"
            onPointerDown={(e) => (startX.current = e.clientX)}
            onPointerUp={(e) => {
              if (startX.current === null) return;
              const dx = e.clientX - startX.current;
              startX.current = null;
              if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
            }}
          >
            {slides.map((x, k) => (
              <div
                key={x.slug}
                aria-hidden={k !== i}
                className={`top-slide ${k === i ? "is-on" : k < i ? "is-before" : ""}`}
              >
                <RecipeImage
                  photo={x.photo}
                  sizes="(min-width: 1240px) 640px, (min-width: 900px) 55vw, 100vw"
                  priority={k === 0}
                  className="nb-lg h-full"
                />
              </div>
            ))}
            {!reduced && (
              <svg key={`steam-${i}`} className="top-steam" viewBox="0 0 120 90" aria-hidden="true">
                <path d="M30 88c-10-14 10-22 0-38s8-24 2-40" />
                <path d="M60 88c-10-16 12-24 0-42s10-26 2-42" />
                <path d="M90 88c-10-14 10-22 0-38s8-24 2-40" />
              </svg>
            )}
            <span key={`stamp-${i}`} className="stamp tone-banane top-stamp" aria-hidden="true">
              <span className="stamp-code">{String(i + 1).padStart(2, "0")}</span>
              <span className="stamp-name">{t.stamp}</span>
            </span>
          </div>

          <div
            role="tablist"
            aria-label={t.label}
            className="flex h-16 gap-2 min-[500px]:h-20 min-[500px]:gap-3"
          >
            {slides.map((x, k) => (
              <button
                key={x.slug}
                type="button"
                role="tab"
                aria-selected={k === i}
                aria-label={t.pick(x.name)}
                onClick={() => go(k)}
                className={`top-thumb nb-flat ${k === i ? "is-on" : ""}`}
                style={{ background: x.photo.bg }}
              >
                <Image src={x.photo.src} alt="" fill sizes="160px" />
                {k === i && running && (
                  <span key={`p-${i}`} className="top-progress" style={{ animationDuration: `${DELAY}ms` }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Triangle « lecture » : l'icône n'existe pas dans le jeu Phosphor de l'interface. */
function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
    </svg>
  );
}
