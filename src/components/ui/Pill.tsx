import type { HTMLAttributes } from "react";

type Tone = "chip" | "violet" | "yellow" | "blue" | "pink" | "peach";

const tones: Record<Tone, string> = {
  chip: "bg-chip text-ink",
  violet: "bg-violet text-white",
  yellow: "bg-yellow-soft text-ink",
  blue: "bg-blue-soft text-blue-ink",
  pink: "bg-pink-soft text-pink-ink",
  peach: "bg-peach text-peach-ink",
};

export function Pill({
  tone = "chip",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 text-sm font-semibold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
