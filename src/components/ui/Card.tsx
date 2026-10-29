import type { HTMLAttributes } from "react";

export type CardTone = "surface" | "violet" | "dark" | "yellow" | "blue" | "pink" | "peach" | "green" | "banane";

const tones: Record<CardTone, string> = {
  surface: "",
  violet: "tone-violet",
  dark: "tone-dark",
  yellow: "tone-yellow",
  blue: "tone-blue",
  pink: "tone-pink",
  peach: "tone-peach",
  green: "tone-green",
  banane: "tone-banane",
};

// Marge intérieure de la maquette : 16 px mobile, 24 px desktop (par défaut) ; « none » pour les cartes à bord perdu.
const paddings = { none: "!p-0", sm: "!p-3", cozy: "", md: "", lg: "!p-8" } as const;

type CardTag = "section" | "div" | "li" | "article" | "figure" | "p" | "ul" | "dl";

/** Surface de base (maquette .card) : bordure encre, rayon 2 px, ombre dure ; `as` choisit l'élément HTML (section par défaut). */
export function Card({
  as: Tag = "section",
  tone = "surface",
  padding = "md",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { as?: CardTag; tone?: CardTone; padding?: keyof typeof paddings }) {
  return <Tag className={`card ${tones[tone]} ${paddings[padding]} ${className}`} {...props} />;
}

/** Page centrée simple (connexion, création de foyer, invitation). */
export function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      {children}
    </main>
  );
}

/** Logo : marque violette à bordure encre et ombre dure, comme la maquette. */
export function Logo({ className = "size-12 text-2xl" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center rounded-r1 border-[length:var(--bw)] border-line bg-violet font-display text-banana shadow-[var(--sh-sm)] ${className}`}
    >
      M
    </span>
  );
}
