import type { MetadataRoute } from "next";
import { SITE_URL } from "@/i18n/associations";

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

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: path.startsWith("/associations") || path === "/" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : path.startsWith("/associations") ? 0.8 : 0.3,
  }));
}
