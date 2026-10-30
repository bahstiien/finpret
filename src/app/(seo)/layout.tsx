import type { ReactNode } from "react";
import { SeoFooter, SeoHeader } from "@/components/seo/Shell";

/** Pages publiques SEO (recettes, menus, hubs) : rendu serveur pur, sans le code de l'application connectée. */
export default function SeoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoHeader />
      {children}
      <SeoFooter />
    </>
  );
}
