import { ImageResponse } from "next/og";
import { ORIGINS } from "@/engine/origins";
import { shareFonts } from "@/app/api/share/fonts";
import { displayName, getRecipe, RECIPES } from "@/seo/catalog";
import { getHub, HUBS } from "@/seo/hubs";
import { getMenu, MENUS } from "@/seo/menus";

/** Image de partage 1200 × 630 générée pour chaque recette, menu et hub (le catalogue ne contient pas de photos). */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...RECIPES.map((r) => ({ type: "recettes", slug: r.slug })),
    ...MENUS.map((m) => ({ type: "menus", slug: m.slug })),
    ...HUBS.map((h) => ({ type: "batch-cooking", slug: h.slug })),
    ...["recettes", "menus", "batch-cooking"].map((type) => ({ type, slug: "index" })),
  ];
}

type Described = { kicker: string; title: string; foot: string; stamp: { code: string; name: string } | null };

function describe(type: string, slug: string): Described | null {
  if (slug === "index") {
    const t = { recettes: "Recettes", menus: "Menus de la semaine", "batch-cooking": "Batch cooking" }[type];
    return t ? { kicker: "FIN PRÊT", title: t, foot: "Ta semaine, prête.", stamp: null } : null;
  }
  if (type === "recettes") {
    const r = getRecipe(slug);
    if (!r) return null;
    const origin = Object.entries(ORIGINS).find(([, o]) => o.name === r.country);
    return {
      kicker: "RECETTE",
      title: displayName(r),
      foot: [r.totalMin ? `${r.totalMin} min` : null, r.yieldText].filter(Boolean).join(" · "),
      stamp: origin ? { code: origin[0].toUpperCase(), name: origin[1].name } : null,
    };
  }
  if (type === "menus") {
    const m = getMenu(slug);
    return m ? { kicker: "MENU DE LA SEMAINE", title: m.h1, foot: `${m.recipes.length} dîners + liste de courses`, stamp: null } : null;
  }
  const h = getHub(slug);
  return h ? { kicker: "BATCH COOKING", title: h.h1, foot: "Menus, recettes et FAQ", stamp: null } : null;
}

const INK = "#17151f";
const BG = "#fff8e7";
const VIOLET = "#7a5af8";
const BANANA = "#ffd23f";
const YELLOW = "#fff6d6";
const DISPLAY = "Archivo Black, Arial Black, sans-serif";
const MONO = "Space Mono, monospace";
const BODY = "Space Grotesk, Arial, sans-serif";

export async function GET(_req: Request, { params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  const d = describe(type, slug);
  if (!d) return new Response("Not found", { status: 404 });
  const size = d.title.length > 50 ? 52 : d.title.length > 28 ? 66 : 84;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, color: INK, fontFamily: BODY }}>
        <div style={{ display: "flex", width: "100%", height: "100%", border: `5px solid ${INK}`, boxSizing: "border-box" }}>
          <div
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "52px 48px 44px 56px" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "flex" }}>
                <div
                  style={{
                    display: "flex",
                    background: BANANA,
                    border: `3px solid ${INK}`,
                    boxShadow: `6px 6px 0 ${INK}`,
                    padding: "8px 14px",
                    fontFamily: MONO,
                    fontWeight: 700,
                    fontSize: 18,
                    textTransform: "uppercase",
                  }}
                >
                  {d.kicker}
                </div>
              </div>
              <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: size, lineHeight: 0.95, textTransform: "uppercase" }}>
                {d.title}
              </div>
              <div style={{ display: "flex" }}>
                <div
                  style={{
                    display: "flex",
                    background: "#ffffff",
                    border: `3px solid ${INK}`,
                    borderRadius: 999,
                    padding: "6px 18px",
                    fontFamily: MONO,
                    fontWeight: 700,
                    fontSize: 22,
                  }}
                >
                  {d.foot}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: DISPLAY, fontSize: 30, textTransform: "uppercase" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 54,
                    height: 54,
                    background: VIOLET,
                    color: BANANA,
                    border: `3px solid ${INK}`,
                    boxShadow: `4px 4px 0 ${INK}`,
                    fontSize: 32,
                  }}
                >
                  F
                </div>
                Fin Prêt
              </div>
              <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 22 }}>finpret.app</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              position: "relative",
              alignItems: "center",
              justifyContent: "center",
              width: 420,
              background: VIOLET,
              borderLeft: `5px solid ${INK}`,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 300,
                height: 340,
                background: YELLOW,
                border: `5px solid ${INK}`,
                boxShadow: `14px 14px 0 ${INK}`,
                transform: "rotate(3deg)",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 16,
                textTransform: "uppercase",
              }}
            >
              {d.kicker === "RECETTE" ? "Photo du plat" : "Fin Prêt"}
            </div>
            {d.stamp && (
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  left: 34,
                  bottom: 44,
                  width: 130,
                  height: 130,
                  borderRadius: 65,
                  background: BANANA,
                  border: `3px solid ${INK}`,
                  color: INK,
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 40 }}>{d.stamp.code}</div>
                <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                  {d.stamp.name}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await shareFonts() },
  );
}
