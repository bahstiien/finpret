import { ImageResponse } from "next/og";
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

function describe(type: string, slug: string): { kicker: string; title: string; foot: string } | null {
  if (slug === "index") {
    const t = { recettes: "Recettes", menus: "Menus de la semaine", "batch-cooking": "Batch cooking" }[type];
    return t ? { kicker: "FIN PRÊT", title: t, foot: "Ta semaine, prête." } : null;
  }
  if (type === "recettes") {
    const r = getRecipe(slug);
    return r
      ? {
          kicker: "RECETTE",
          title: displayName(r),
          foot: [r.totalMin ? `${r.totalMin} min` : null, r.yieldText].filter(Boolean).join(" · "),
        }
      : null;
  }
  if (type === "menus") {
    const m = getMenu(slug);
    return m ? { kicker: "MENU DE LA SEMAINE", title: m.h1, foot: `${m.recipes.length} dîners + liste de courses` } : null;
  }
  const h = getHub(slug);
  return h ? { kicker: "BATCH COOKING", title: h.h1, foot: "Menus, recettes et FAQ" } : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  const d = describe(type, slug);
  if (!d) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
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
        <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: 2 }}>FIN PRÊT · {d.kicker}</div>
        <div style={{ display: "flex", fontSize: d.title.length > 50 ? 60 : 78, fontWeight: 900, lineHeight: 1.05 }}>
          {d.title}
        </div>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            background: "#ffd23f",
            color: "#17151f",
            fontSize: 32,
            fontWeight: 800,
            padding: "14px 32px",
            borderRadius: 999,
          }}
        >
          {d.foot}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
