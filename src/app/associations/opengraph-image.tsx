import { ImageResponse } from "next/og";
import { associationsFr } from "@/i18n/associations";

export const alt = associationsFr.meta.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage 1200 × 630 aux couleurs du design system (violet, banane, encre). */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#7a5af8",
        color: "#ffffff",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 2 }}>FIN PRÊT</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1.05 }}>
          Financez les projets de votre APE, sans vendre de chocolats
        </div>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
          8 € par famille abonnée, chaque année
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignSelf: "flex-start",
          background: "#ffd23f",
          color: "#17151f",
          fontSize: 34,
          fontWeight: 800,
          padding: "16px 36px",
          borderRadius: 999,
        }}
      >
        finpret.app/associations
      </div>
    </div>,
    size,
  );
}
