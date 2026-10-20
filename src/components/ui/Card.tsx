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

const paddings = { none: "", sm: "p-4", cozy: "p-5", md: "p-6", lg: "p-8" } as const;

/** Surface de base de l'interface : rayon 28 px, quatre teintes douces et deux teintes pleines. */
export function Card({
  tone = "surface",
  padding = "md",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: CardTone; padding?: keyof typeof paddings }) {
  return <section className={`rounded-card ${tones[tone]} ${paddings[padding]} ${className}`} {...props} />;
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
      className={`grid place-items-center rounded-2xl bg-violet font-display font-black text-white ${className}`}
    >
      M
    </span>
  );
}
