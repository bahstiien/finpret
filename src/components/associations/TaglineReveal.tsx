"use client";

import { useEffect, useRef } from "react";

/**
 * Phrase de fond de la page : chaque mot passe du ton atténué (30 % de l'encre) à l'encre pleine
 * en franchissant une ligne située à 60 % de la hauteur de l'écran, dans l'ordre de lecture.
 * Sans JavaScript, ou avec `prefers-reduced-motion`, tout le texte reste en encre pleine.
 * Les styles sont dans globals.css (`.tagline`).
 */
export function TaglineReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.dataset.ready = "true";
    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-word]"));
    const line = () => window.innerHeight * 0.6;
    // Un mot est allumé tant qu'il est au-dessus de la ligne ; l'observateur ne sert qu'à être prévenu
    // quand il la franchit (marge basse de 40 % : la ligne de déclenchement est le bord de la zone).
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).dataset.on = String(entry.boundingClientRect.top < line());
        }
      },
      { rootMargin: "0px 0px -40% 0px", threshold: [0, 1] },
    );
    words.forEach((word) => observer.observe(word));
    return () => {
      observer.disconnect();
      delete root.dataset.ready;
    };
  }, []);
  return (
    <p ref={ref} className={`tagline ${className}`}>
      {text.split(" ").map((word, i) => (
        <span key={i}>
          <span data-word className="tagline-word">
            {word}
          </span>{" "}
        </span>
      ))}
    </p>
  );
}
