/** Icônes de la page d'accueil : tracé arrondi de 2 px sur grille 24 px, couleur du texte voisin. */
const paths = {
  check: "M5 12.5l4.5 4.5L19 7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  chevron: "M6 9l6 6 6-6",
  utensils: "M7 3v7M4 3v5a3 3 0 0 0 6 0V3M7 10v11M17 21V3c-2.5 1.5-3.5 4-3.5 8H17",
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z",
  basket: "M3.5 9h17l-1.7 10.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8zM8 9l3-5.5M16 9l-3-5.5",
  fridge:
    "M9 2.5h6A3 3 0 0 1 18 5.5v13a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3zM6 9.5h12M9 6v1.5M9 13v3",
  timer: "M12 6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 13.5V9.5M9.5 2.5h5",
  snowflake: "M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9",
  pot: "M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 12.5h2M20 12.5h2M6 8.5c3-2 9-2 12 0",
  users:
    "M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5M16.5 4.3a3.5 3.5 0 0 1 0 6.4M18 15.2c1.9.6 3.1 2.1 3.5 4.8",
  share: "M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  link: "M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1",
  shield: "M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z",
  calendar:
    "M5 5.5h14A1.5 1.5 0 0 1 20.5 7v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5zM3.5 9.5h17M8 3v4M16 3v4",
  phone:
    "M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2",
  home: "M3 11l9-7.5 9 7.5M5.5 9.5V20h13V9.5",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "size-6" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={paths[name]} />
    </svg>
  );
}
