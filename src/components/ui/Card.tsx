import type { HTMLAttributes } from "react";

export type CardTone = "surface" | "violet" | "dark" | "yellow" | "blue" | "pink" | "peach" | "green";

const tones: Record<CardTone, string> = {
  surface: "bg-surface",
  violet: "bg-violet text-white",
  dark: "bg-nav text-on-nav",
  yellow: "bg-yellow-soft",
  blue: "bg-blue-soft text-blue-ink",
  pink: "bg-pink-soft text-pink-ink",
  peach: "bg-peach text-peach-ink",
  green: "bg-green-soft text-green-ink",
};

const edge = "border-[length:var(--bw)] border-line shadow-hard-sm";

const paddings = { none: "", sm: "p-4", cozy: "p-4", md: "p-6", lg: "p-8" } as const;

type CardTag = "section" | "div" | "li" | "article" | "figure" | "p" | "ul" | "dl";

/** Surface de base de l'interface : rayon 4 px, bordure encre et ombre dure, huit teintes ; `as` choisit l'élément HTML (section par défaut). */
export function Card({
  as: Tag = "section",
  tone = "surface",
  padding = "md",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { as?: CardTag; tone?: CardTone; padding?: keyof typeof paddings }) {
  return <Tag className={`rounded-card ${edge} ${tones[tone]} ${paddings[padding]} ${className}`} {...props} />;
}

/** Page centrée simple (connexion, création de foyer, invitation). */
export function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      {children}
    </main>
  );
}

export function Logo({ className = "size-12 text-2xl" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center rounded-r2 border-[length:var(--bw)] border-line bg-violet font-display text-white shadow-hard-sm ${className}`}
    >
      M
    </span>
  );
}
