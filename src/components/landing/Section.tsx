import type { ReactNode } from "react";

/** Colonne centrée des pages publiques : 1 240 px, ou 768 px (`narrow`) pour les textes longs. */
export function Container({
  children,
  className = "",
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div className={`mx-auto w-full px-4 min-[900px]:px-10 ${narrow ? "max-w-3xl" : "max-w-[1240px]"} ${className}`}>
      {children}
    </div>
  );
}
