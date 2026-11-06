import Image from "next/image";
import type { OnboardingDish } from "@/server/onboarding-data";

const RATIOS = { carre: "1 / 1", paysage: "4 / 3", large: "16 / 10", portrait: "3 / 4" } as const;

/**
 * Photo de plat de l'onboarding : le cadre prend la couleur du fond du visuel (fond de secours pendant le chargement),
 * légende facultative. Décorative par défaut quand le nom est écrit à côté.
 */
export function DishPhoto({
  dish,
  format = "paysage",
  sizes,
  caption = false,
  priority = false,
  decorative = true,
  className = "",
}: {
  dish: OnboardingDish;
  format?: keyof typeof RATIOS;
  sizes: string;
  caption?: boolean;
  priority?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  const img = (
    <div
      className="relative overflow-hidden"
      style={{ aspectRatio: RATIOS[format], background: dish.photo.bg }}
    >
      <Image
        src={dish.photo.src}
        alt={decorative && !caption ? "" : dish.photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
  if (!caption) return <div className={className}>{img}</div>;
  return (
    <figure className={`nb-sm m-0 flex flex-col overflow-hidden bg-surface ${className}`}>
      {img}
      <figcaption className="t-small border-t-[length:var(--bw)] border-line px-2 py-2 font-bold">
        {dish.name}
      </figcaption>
    </figure>
  );
}
