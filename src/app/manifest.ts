import type { MetadataRoute } from "next";
import { fr } from "@/i18n/fr";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: fr.app.name,
    short_name: fr.app.shortName,
    description: fr.app.description,
    lang: "fr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F4F3F8",
    theme_color: "#7A5AF8",
    categories: ["food", "lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Cible de partage pour l'import de recettes par lien (SPEC §8.8).
    share_target: {
      action: "/app/discover/import",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
