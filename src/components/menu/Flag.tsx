import type { Flag as FlagData } from "@/server/menu-view";

/**
 * Drapeau emoji du pays d'origine. Windows ne dessine pas ces emoji : la police Twemoji Country Flags
 * (déclarée dans globals.css, limitée aux indicateurs régionaux) les affiche partout, sans badge de repli.
 */
export function Flag({ flag }: { flag: FlagData }) {
  if (!flag) return null;
  return (
    <span
      role="img"
      aria-label={flag.name}
      title={flag.name}
      className="mr-1"
      style={{ fontFamily: '"Twemoji Country Flags", "Apple Color Emoji", "Segoe UI Emoji", sans-serif' }}
    >
      {flag.emoji}
    </span>
  );
}
