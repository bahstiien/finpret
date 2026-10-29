"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { associationsFr } from "@/i18n/associations";

const t = associationsFr.nav;

const links = [
  { href: "/associations", label: t.associations },
  { href: "/associations/comment-ca-marche", label: t.how },
] as const;

const itemBase =
  "inline-flex min-h-11 items-center rounded-card px-4 py-2 text-sm font-semibold transition duration-300 ease-base hover:bg-chip aria-[current=page]:bg-chip";

/**
 * Barre de navigation des pages publiques : compacte, centrée, flottante, sur surface translucide floutée.
 * Sur mobile, le bouton ouvre un panneau plein écran dont les liens arrivent l'un après l'autre.
 */
export function PublicNav({ signup = true }: { signup?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  // Le panneau se ferme au changement de page, et avec Échap (le focus revient sur le bouton).
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const line = "absolute top-1/2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-sm bg-ink transition-transform duration-500 ease-base motion-reduce:transition-none";
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <header className="pointer-events-auto flex max-w-full items-center gap-2 rounded-card border border-line bg-surface/70 p-2 shadow-hard ">
          <Link
            href="/"
            aria-label={t.homeAria}
            className="inline-flex min-h-11 items-center gap-2 rounded-card px-2 text-base font-bold"
          >
            <Image src="/brand/finpret-symbole.svg" alt="" width={32} height={32} className="size-8" />
            {t.home}
          </Link>
          <nav aria-label={t.label} className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname === l.href ? "page" : undefined}
                className={itemBase}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {signup && (
            <Link
              href="/asso/inscription"
              className="inline-flex min-h-11 items-center rounded-card bg-banana px-4 py-2 text-sm font-semibold text-[#17151f] transition duration-300 ease-base hover:brightness-95 border-[length:var(--bw)] border-line"
            >
              {t.signup}
            </Link>
          )}
          <button
            ref={toggle}
            type="button"
            aria-expanded={open}
            aria-controls="menu-public"
            aria-label={open ? t.close : t.open}
            onClick={() => setOpen((v) => !v)}
            className="relative size-11 shrink-0 rounded-card hover:bg-chip md:hidden border-[length:var(--bw)] border-line"
          >
            <span className={`${line} ${open ? "rotate-45" : "-translate-y-1"}`} />
            <span className={`${line} ${open ? "-rotate-45" : "translate-y-1"}`} />
          </button>
        </header>
      </div>

      <div
        id="menu-public"
        inert={!open}
        className={`fixed inset-0 z-40 flex flex-col justify-center bg-bg/95 px-6  transition-opacity duration-500 ease-base md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <nav aria-label={t.label} className="flex flex-col items-start gap-4">
          {links.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              style={{ transitionDelay: open ? `${i * 60}ms` : "0ms" }}
              className={`min-h-11 text-3xl font-semibold transition duration-500 ease-base aria-[current=page]:underline aria-[current=page]:underline-offset-8 motion-reduce:translate-y-0 ${
                open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
