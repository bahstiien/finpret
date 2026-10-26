import type { MetadataRoute } from "next";
import { SITE_URL } from "@/i18n/associations";

/**
 * Les espaces connectés, l'API et les liens d'invitation ne sont pas faits pour être trouvés.
 * Attention : `Disallow: /asso` bloquerait aussi `/associations` (correspondance par préfixe) ; on écrit donc
 * `/asso/` et `/asso$`, qui ne visent que l'espace association.
 */
export const DISALLOWED = [
  "/app/",
  "/app$",
  "/asso/",
  "/asso$",
  "/admin/",
  "/admin$",
  "/api/",
  "/join/",
  "/dashboard/",
  "/dashboard$",
  "/settings/",
  "/settings$",
  "/onboarding/",
  "/onboarding$",
  "/login$",
  "/auth/",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...DISALLOWED] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
