import Image from "next/image";
import type { RecipePhoto } from "@/seo/images";

/**
 * Photo de recette au format 4:3. Le cadre prend la couleur du fond uni du visuel : pas de saut de mise en page ni de
 * trou blanc pendant le chargement. `decorative` vide l'alt quand le nom du plat est déjà écrit à côté.
 */
export function RecipeImage({
  photo,
  sizes,
  className = "",
  priority = false,
  decorative = false,
}: {
  photo: RecipePhoto;
  sizes: string;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  return (
    <div className={`recipe-img ${className}`} style={{ background: photo.bg }}>
      <Image src={photo.src} alt={decorative ? "" : photo.alt} fill sizes={sizes} priority={priority} />
    </div>
  );
}
