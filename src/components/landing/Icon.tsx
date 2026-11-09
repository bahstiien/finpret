import { Glyph } from "@/components/ui/Icon";
import type { GlyphName } from "@/components/ui/glyphs";

/** Icônes de la page d'accueil : Phosphor (graisse « regular »), couleur du texte voisin. */
const icons = {
  check: "Check",
  close: "X",
  arrow: "ArrowRight",
  plus: "Plus",
  chevron: "CaretDown",
  utensils: "ForkKnife",
  compass: "Compass",
  basket: "Basket",
  fridge: "Thermometer",
  timer: "Timer",
  snowflake: "Snowflake",
  pot: "CookingPot",
  users: "Users",
  share: "ShareNetwork",
  sparkle: "Sparkle",
  link: "Link",
  shield: "ShieldCheck",
  calendar: "CalendarBlank",
  phone: "DeviceMobile",
  home: "House",
} as const satisfies Record<string, GlyphName>;

export type IconName = keyof typeof icons;

export function Icon({ name, className = "size-6" }: { name: IconName; className?: string }) {
  return <Glyph name={icons[name]} aria-hidden="true" className={`shrink-0 ${className}`} />;
}
