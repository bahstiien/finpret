import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`rounded-card bg-surface p-6 ${className}`} {...props} />;
}

/** Page centrée simple (connexion, création de foyer, invitation). */
export function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      {children}
    </main>
  );
}

export function Logo() {
  return (
    <span
      aria-hidden="true"
      className="grid size-12 place-items-center rounded-2xl bg-violet font-display text-2xl font-black text-white"
    >
      M
    </span>
  );
}
