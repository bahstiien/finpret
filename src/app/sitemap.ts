import type { MetadataRoute } from "next";
import { SITE_URL } from "@/i18n/associations";
import { CONTENT_LASTMOD } from "@/seo/config";
import { seoPaths } from "@/seo/paths";

/** Pages publiques indexables. Les pages /ecole/[code], /app, /asso, /admin et /join n'y figurent pas (SPEC_JANVIER §8 bis). */
export const PUBLIC_PATHS = [
  "/",
  "/associations",
  "/associations/comment-ca-marche",
  "/mentions-legales",
  "/cgu",
  "/cgv",
  "/confidentialite",
  "/partenariat-associations",
] as const;

/**
 * Un seul sitemap (moins de 500 URL, très en dessous de la limite de 50 000) : pages publiques et couche SEO
 * (recettes, menus, hubs). Seules les pages indexables y figurent ; les menus et hubs sous le seuil en sont exclus.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: path.startsWith("/associations") || path === "/" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : path.startsWith("/associations") ? 0.8 : 0.3,
  }));
  const seo: MetadataRoute.Sitemap = seoPaths().map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: CONTENT_LASTMOD,
    changeFrequency: "monthly",
    priority,
  }));
  return [...pages, ...seo];
}
