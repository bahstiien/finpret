import type { HTMLAttributes } from "react";

export type PillTone = "chip" | "violet" | "yellow" | "blue" | "pink" | "peach" | "green" | "dark" | "banane";

const tones: Record<PillTone, string> = {
  chip: "tone-chip",
  violet: "tone-violet",
  yellow: "tone-yellow",
  blue: "tone-blue",
  pink: "tone-pink",
  peach: "tone-peach",
  green: "tone-green",
  dark: "tone-dark",
  banane: "tone-banane",
};

/** Pastille d'état ou d'étiquette (maquette .pill, seul élément arrondi ; aussi exportée sous le nom `Badge`). */
export function Pill({
  tone = "chip",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: PillTone }) {
  return <span className={`pill ${tones[tone]} ${className}`} {...props} />;
}

export { Pill as Badge };
