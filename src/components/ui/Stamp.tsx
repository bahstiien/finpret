import type { Season } from "@/engine/passport";
import { fr } from "@/i18n/fr";

/**
 * Tampon du passeport des saveurs (maquette Nos progrès, Stamp du design system) : rond pour un pays, carré pour une
 * saison. Obtenu : fond de couleur, code et nom à l'intérieur, légère rotation stable dérivée du code.
 * Vide : contour pointillé. Saison en cours : l'encre monte par le bas, recette après recette.
 * Bouton quand `onPress` est fourni, sinon simple image annoncée par `ariaLabel`.
 */

type Props = {
  kind: "country" | "season";
  state: "earned" | "empty" | "progress";
  /** Nom affiché dans le tampon (« Italie · 03.05 », « Automne 2026 »). */
  name: string;
  /** Code en capitales (« IT », « AU »). */
  code: string;
  season?: Season;
  /** Légende sous le tampon (« 3 recettes sur 8 »). */
  legend?: string;
  ariaLabel: string;
  /** Classe de ton (`tone-green`…) ; par défaut, dérivée du code. */
  tone?: string;
  /** Part d'encre (0 à 1) d'une saison en cours. */
  fill?: number;
  isNew?: boolean;
  /** Drapeau en bas à droite du tampon. */
  flag?: React.ReactNode;
  /** Petite taille (mobile) : 93 px au lieu de 108. */
  compact?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

const COUNTRY_TONES = ["tone-green", "tone-pink", "tone-peach", "tone-blue", "tone-banane"];

export const SEASON_TONE: Record<Season, string> = {
  winter: "tone-stock",
  spring: "tone-courses",
  summer: "tone-banane",
  autumn: "tone-session",
};

const SEASON_COLOR: Record<Season, string> = {
  winter: "var(--stock)",
  spring: "var(--courses)",
  summer: "var(--banane)",
  autumn: "var(--session)",
};

export const SEASON_CODE: Record<Season, string> = { winter: "HI", spring: "PR", summer: "ÉT", autumn: "AU" };

function hash(code: string) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h;
}

/** Rotation stable (même tampon, même angle à chaque affichage) entre −6° et +6°. */
export function stampRotation(code: string): number {
  return (hash(code) % 13) - 6;
}

export const countryTone = (code: string) => COUNTRY_TONES[hash(code) % COUNTRY_TONES.length]!;

export function Stamp({
  kind,
  state,
  name,
  code,
  season,
  legend,
  ariaLabel,
  tone,
  fill = 0,
  isNew,
  flag,
  compact,
  onPress,
  disabled,
}: Props) {
  const earned = state === "earned";
  const square = kind === "season";
  const toneClass = earned ? (tone ?? (season ? SEASON_TONE[season] : countryTone(code))) : "stamp--empty";
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  const style: React.CSSProperties = earned
    ? { transform: `rotate(${stampRotation(code)}deg)` }
    : state === "progress" && season
      ? { background: `linear-gradient(to top, ${SEASON_COLOR[season]} ${pct}%, transparent ${pct}%)` }
      : {};
  const box = compact ? "size-[93px]" : "size-[108px]";
  const inner = (
    <>
      <span aria-hidden="true" className={`relative flex flex-none items-center justify-center ${box}`}>
        <span className={`flex flex-none ${compact ? "scale-[.86]" : ""}`}>
          <span
            style={style}
            className={`stamp ${square ? "stamp--sq" : ""} ${toneClass} ${earned && isNew ? "stamp--new" : ""}`}
          >
            <span className="stamp-code">{code}</span>
            <span className="stamp-name">{name}</span>
          </span>
        </span>
        {flag && <span className="absolute -right-1 bottom-1.5 flex">{flag}</span>}
        {isNew && (
          <span className="pill absolute -top-1.5 -left-2 !bg-[var(--ink-fixed)] !text-[var(--banane)]">
            {fr.progress.passport.newBadge}
          </span>
        )}
      </span>
      {legend && (
        <span aria-hidden="true" className="t-small max-w-full [text-wrap:balance]">
          {legend}
        </span>
      )}
    </>
  );
  const cls = "flex min-w-0 flex-col items-center gap-2 p-0 text-center text-[var(--ink-fixed)]";
  return onPress ? (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      data-state={state}
      data-stamp={`${kind}:${code}`}
      className={cls}
    >
      {inner}
    </button>
  ) : (
    <span role="img" aria-label={ariaLabel} data-state={state} data-stamp={`${kind}:${code}`} className={cls}>
      {inner}
    </span>
  );
}
