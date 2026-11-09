import type { SVGProps } from "react";
import { GLYPHS as PATHS, type GlyphName } from "./glyphs";

/** Icônes Phosphor (graisse « regular »), une seule famille et un seul trait pour toute l'application. Décoratives par défaut. */
const GLYPHS = {
  menu: "ForkKnife",
  compass: "Compass",
  basket: "Basket",
  fridge: "Thermometer",
  timer: "Timer",
  print: "Printer",
  more: "DotsThree",
  clock: "Clock",
  pot: "CookingPot",
  snow: "Snowflake",
  user: "User",
  plus: "Plus",
  check: "Check",
  users: "Users",
  sparkle: "Sparkle",
  close: "X",
  cake: "Cake",
  thumbUp: "ThumbsUp",
  thumbDown: "ThumbsDown",
  // Série et passeport (SPEC_PROGRES §5).
  streak: "CalendarCheck",
  pause: "PauseCircle",
  passport: "Stamp",
  trophy: "Trophy",
  lock: "LockSimple",
  // Anti-gaspi (écran Progrès).
  leaf: "Leaf",
  chevronRight: "CaretRight",
  chevronDown: "CaretDown",
  arrowBack: "ArrowLeft",
  arrowRight: "ArrowRight",
  search: "MagnifyingGlass",
  info: "Info",
  warning: "Warning",
  share: "ShareNetwork",
  // Back-office (menu latéral).
  dashboard: "SquaresFour",
  inbox: "Tray",
  todo: "ListChecks",
  chart: "ChartBar",
  card: "CreditCard",
  tag: "Tag",
  school: "GraduationCap",
  handshake: "Handshake",
  bank: "Bank",
  lifebuoy: "Lifebuoy",
  journal: "Notebook",
  shield: "ShieldCheck",
  clipboard: "ClipboardText",
  hamburger: "List",
  // Onboarding : foyer, envies, restrictions, rythme.
  household: "UsersThree",
  baby: "Baby",
  prohibit: "Prohibit",
  calendar: "CalendarDots",
  scales: "Scales",
  plant: "Plant",
  carrot: "Carrot",
  fish: "Fish",
  cow: "Cow",
  barbell: "Barbell",
  piggy: "PiggyBank",
  sun: "Sun",
  moon: "Moon",
  sunHorizon: "SunHorizon",
  coffee: "Coffee",
  moonStars: "MoonStars",
  chefHat: "ChefHat",
  retry: "ArrowClockwise",
  sliders: "Sliders",
  // Allergènes (pictogrammes approchants quand Phosphor n'a pas l'aliment).
  grains: "Grains",
  shrimp: "Shrimp",
  egg: "Egg",
  peanut: "CoffeeBean",
  drop: "Drop",
  acorn: "Acorn",
  jar: "JarLabel",
  sesame: "DotsNine",
  wine: "Wine",
  flower: "Flower",
  spiral: "Spiral",
} as const satisfies Record<string, GlyphName>;

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
  return (
    <Glyph
      name={GLYPHS[name]}
      className={`shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    />
  );
}

/** SVG d'un tracé Phosphor, avec les mêmes attributs que les composants Phosphor (1em, couleur du texte). */
export function Glyph({ name, ...props }: { name: GlyphName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="currentColor"
      viewBox="0 0 256 256"
      {...props}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
