import type { HTMLAttributes } from "react";

export type PillTone = "chip" | "violet" | "yellow" | "blue" | "pink" | "peach" | "green" | "dark";

const tones: Record<PillTone, string> = {
  chip: "bg-chip text-ink",
  violet: "bg-violet text-white",
  yellow: "bg-yellow-soft text-ink",
  blue: "bg-blue-soft text-blue-ink",
  pink: "bg-pink-soft text-pink-ink",
  peach: "bg-peach text-peach-ink",
  green: "bg-green-soft text-green-ink",
  dark: "bg-ink text-surface",
};

/** Pastille d'état ou d'étiquette (aussi exportée sous le nom `Badge`). */
export function Pill({
  tone = "chip",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: PillTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 text-sm font-semibold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export { Pill as Badge };
