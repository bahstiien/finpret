import type { Metadata, Viewport } from "next";
import { Figtree, Gabarito } from "next/font/google";
import { fr } from "@/i18n/fr";
import "./globals.css";

const gabarito = Gabarito({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-gabarito",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: fr.app.name, template: `%s · ${fr.app.name}` },
  description: fr.app.description,
  applicationName: fr.app.name,
  appleWebApp: { capable: true, title: fr.app.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F3F8" },
    { media: "(prefers-color-scheme: dark)", color: "#121019" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${gabarito.variable} ${figtree.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
