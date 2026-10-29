import type { Season } from "@/engine/passport";
import { Icon, type IconName } from "./Icon";

/**
 * Tampon du passeport des saveurs (SPEC_PROGRES §5) : cercle de 72 px dans une cible de 88 px, bordure de 2 px.
 * Obtenu : fond doux et code en couleur, légère rotation stable dérivée du code (−6° à +6°). Vide : contour pointillé.
 * Bouton, avec un libellé complet pour les lecteurs d'écran ; l'apparition est animée sauf `prefers-reduced-motion`.
 */

type Props = {
  kind: "country" | "season";
  state: "earned" | "empty";
  label: string;
  /** Code pays en capitales (« JP »), ou saison pour un tampon de saison. */
  code: string;
  season?: Season;
  count?: string;
  ariaLabel: string;
  onPress?: () => void;
  disabled?: boolean;
};

const SEASON_ICON: Record<Season, IconName> = {
  winter: "snow",
  spring: "sparkle",
  summer: "clock",
  autumn: "pot",
};

const SEASON_TONE: Record<Season, string> = {
  winter: "border-blue-ink bg-blue-soft text-blue-ink",
  spring: "border-green-strong bg-green-soft text-green-strong",
  summer: "border-[#17151F] bg-banana text-[#17151F]",
  autumn: "border-cream-ink bg-yellow-soft text-cream-ink",
};

/** Rotation stable (même tampon, même angle à chaque affichage) entre −6° et +6°. */
export function stampRotation(code: string): number {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 13) - 6;
}

export function Stamp({ kind, state, label, code, season, count, ariaLabel, onPress, disabled }: Props) {
  const earned = state === "earned";
  const tone =
    kind === "season" && season
      ? earned
        ? SEASON_TONE[season]
        : "border-dashed border-line bg-transparent text-muted"
      : earned
        ? "border-violet bg-violet-soft text-violet-strong"
        : "border-dashed border-line bg-transparent text-muted";
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      data-state={state}
      data-stamp={`${kind}:${code}`}
      className="flex min-h-22 w-22 flex-col items-center gap-1 rounded-card p-0 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
    >
      <span
        aria-hidden="true"
        style={earned ? { transform: `rotate(${stampRotation(code)}deg)` } : undefined}
        className={`grid size-18 place-items-center rounded-full border-2 font-display text-xl font-bold ${tone} ${
          earned ? "motion-safe:animate-[stamp-in_.35s_ease-out]" : ""
        }`}
      >
        {kind === "season" && season ? <Icon name={SEASON_ICON[season]} className="size-8" /> : code}
      </span>
      <span aria-hidden="true" className="w-full text-xs leading-tight font-bold [overflow-wrap:anywhere]">
        {label}
      </span>
      {count && (
        <span aria-hidden="true" className="text-xs leading-none text-muted">
          {count}
        </span>
      )}
    </button>
  );
}
