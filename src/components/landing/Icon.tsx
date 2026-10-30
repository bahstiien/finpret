import type { ComponentType, SVGProps } from "react";
import {
  ArrowRight,
  Basket,
  CalendarBlank,
  Check,
  CaretDown,
  Compass,
  CookingPot,
  DeviceMobile,
  ForkKnife,
  House,
  Link,
  Plus,
  ShareNetwork,
  ShieldCheck,
  Snowflake,
  Sparkle,
  Thermometer,
  Timer,
  Users,
  X,
} from "@phosphor-icons/react/ssr";

/** Icônes de la page d'accueil : Phosphor (graisse « regular »), couleur du texte voisin. */
const icons = {
  check: Check,
  close: X,
  arrow: ArrowRight,
  plus: Plus,
  chevron: CaretDown,
  utensils: ForkKnife,
  compass: Compass,
  basket: Basket,
  fridge: Thermometer,
  timer: Timer,
  snowflake: Snowflake,
  pot: CookingPot,
  users: Users,
  share: ShareNetwork,
  sparkle: Sparkle,
  link: Link,
  shield: ShieldCheck,
  calendar: CalendarBlank,
  phone: DeviceMobile,
  home: House,
} as const satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

export type IconName = keyof typeof icons;

export function Icon({ name, className = "size-6" }: { name: IconName; className?: string }) {
  const Glyph = icons[name];
  return <Glyph aria-hidden="true" className={`shrink-0 ${className}`} />;
}
