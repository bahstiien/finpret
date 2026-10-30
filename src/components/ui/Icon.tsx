import type { ComponentType, SVGProps } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Basket,
  CalendarCheck,
  CaretDown,
  CaretRight,
  Cake,
  Check,
  Clock,
  Compass,
  CookingPot,
  DotsThree,
  ForkKnife,
  Info,
  MagnifyingGlass,
  PauseCircle,
  Plus,
  Printer,
  ShareNetwork,
  Snowflake,
  Sparkle,
  Stamp,
  Thermometer,
  ThumbsDown,
  ThumbsUp,
  Timer,
  User,
  Users,
  Warning,
  X,
} from "@phosphor-icons/react/ssr";

/** Icônes Phosphor (graisse « regular »), une seule famille et un seul trait pour toute l'application. Décoratives par défaut. */
const GLYPHS = {
  menu: ForkKnife,
  compass: Compass,
  basket: Basket,
  fridge: Thermometer,
  timer: Timer,
  print: Printer,
  more: DotsThree,
  clock: Clock,
  pot: CookingPot,
  snow: Snowflake,
  user: User,
  plus: Plus,
  check: Check,
  users: Users,
  sparkle: Sparkle,
  close: X,
  cake: Cake,
  thumbUp: ThumbsUp,
  thumbDown: ThumbsDown,
  // Série et passeport (SPEC_PROGRES §5).
  streak: CalendarCheck,
  pause: PauseCircle,
  passport: Stamp,
  chevronRight: CaretRight,
  chevronDown: CaretDown,
  arrowBack: ArrowLeft,
  arrowRight: ArrowRight,
  search: MagnifyingGlass,
  info: Info,
  warning: Warning,
  share: ShareNetwork,
} as const satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

export type IconName = keyof typeof GLYPHS;

export function Icon({
  name,
  className = "size-6",
  label,
}: {
  name: IconName;
  className?: string;
  label?: string;
}) {
  const Glyph = GLYPHS[name];
  return (
    <Glyph
      className={`shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    />
  );
}
