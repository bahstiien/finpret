"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Apparition d'une section au défilement : elle monte de 32 px en fondu, une seule fois.
 * Le HTML est complet sans JavaScript ; l'état masqué n'est posé qu'après le montage, et
 * seulement pour ce qui est encore sous la ligne de flottaison. Les styles sont dans globals.css
 * (`[data-reveal]`) : avec `prefers-reduced-motion`, le mouvement devient un simple fondu.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
