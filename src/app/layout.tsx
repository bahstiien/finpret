import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import { fr } from "@/i18n/fr";
import "./globals.css";

// Archivo Black (titres, capitales), Space Grotesk (texte), Space Mono (chiffres, métadonnées).
const archivo = Archivo_Black({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-archivo", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], variable: "--font-grotesk", display: "swap" });
const spaceMono = Space_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "700"], variable: "--font-space-mono", display: "swap" });

export const metadata: Metadata = {
  // Base des URL absolues (image de partage, canonical) : finpret.app en production.
  metadataBase: new URL(process.env.APP_URL ?? "https://finpret.app"),
  title: { default: fr.app.name, template: `%s · ${fr.app.name}` },
  description: fr.app.description,
  applicationName: fr.app.name,
  appleWebApp: { capable: true, title: fr.app.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8E7" },
    { media: "(prefers-color-scheme: dark)", color: "#181818" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${archivo.variable} ${grotesk.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Thème choisi sur cet appareil (§11), appliqué avant l'affichage pour éviter un flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
