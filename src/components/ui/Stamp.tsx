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
  winter: "tone-blue",
  spring: "tone-green",
  summer: "tone-banane",
  autumn: "tone-peach",
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
        : "stamp--empty"
      : earned
        ? "tone-violet"
        : "stamp--empty";
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      data-state={state}
      data-stamp={`${kind}:${code}`}
      className="flex flex-col items-center gap-2 p-0 text-center"
    >
      <span
        aria-hidden="true"
        style={earned ? { transform: `rotate(${stampRotation(code)}deg)` } : undefined}
        className={`stamp ${kind === "season" ? "stamp--sq" : ""} ${tone} ${earned ? "stamp--new" : ""}`}
      >
        {kind === "season" && season ? <Icon name={SEASON_ICON[season]} className="ic-lg" /> : <span className="stamp-code">{code}</span>}
      </span>
      <span aria-hidden="true" className="stamp-name !max-w-full">
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
