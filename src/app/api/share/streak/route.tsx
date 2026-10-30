import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import { isMilestone } from "@/engine/streak";
import { fr } from "@/i18n/fr";
import { trackEvent } from "@/server/events";
import { shareFonts } from "../fonts";
import { milestoneMeals } from "@/server/progress-share";
import { getActiveHousehold, getUser, withSession } from "@/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIOLET = "#7a5af8";
const BANANA = "#ffd23f";
const INK = "#17151f";
const BG = "#fff8e7";
const GREEN = "#1fa85a";
const PEACH = "#ff8c42";
const BLUE = "#4d96ff";
const DISPLAY = "Archivo Black, Arial Black, sans-serif";
const MONO = "Space Mono, monospace";
const BODY = "Space Grotesk, sans-serif";

/** Tampon décoratif (cercle ou carré) : bordure encre, filet pointillé intérieur, texte encre. */
function StampArt({ code, name, bg, size, square, rotate, left, top }: {
  code: string; name: string; bg: string; size: number; square?: boolean; rotate: number; left: number; top: number;
}) {
  const radius = square ? 4 : size;
  return (
    <div
      style={{
        position: "absolute", left, top, width: size, height: size, display: "flex", alignItems: "center",
        justifyContent: "center", background: bg, border: `6px solid ${INK}`, borderRadius: radius,
        transform: `rotate(${rotate}deg)`, color: INK,
      }}
    >
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          width: size - 32, height: size - 32, border: `3px dashed ${INK}`, borderRadius: square ? 0 : size,
        }}
      >
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 54, lineHeight: 1 }}>{code}</div>
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 16, letterSpacing: 1, textTransform: "uppercase" }}>
          {name}
        </div>
      </div>
    </div>
  );
}

/**
 * Carte de palier à partager (SPEC_PROGRES §3.6) : 1080 × 1350, générée côté serveur, réservée à un compte connecté
 * dont le foyer a atteint ce palier. Aucun prénom ni nom de foyer, aucune donnée personnelle dans l'URL (le palier seul).
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  const household = user ? await getActiveHousehold() : null;
  if (!user || !household) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const milestone = Number(request.nextUrl.searchParams.get("milestone"));
  if (!Number.isInteger(milestone) || !isMilestone(milestone)) {
    return NextResponse.json({ error: "milestone" }, { status: 400 });
  }
  // Le foyer doit avoir atteint ce palier (ou un palier supérieur) : lecture avec la RLS.
  const reached = await withSession((db) =>
    db
      .selectFrom("achievements")
      .select("key")
      .where("household_id", "=", household.id)
      .where("kind", "=", "streak")
      .execute(),
  );
  if (!reached.some((a) => Number(a.key) >= milestone)) {
    return NextResponse.json({ error: "not_reached" }, { status: 403 });
  }

  const meals = await milestoneMeals(household.id, milestone);
  await trackEvent("share_card_created", {
    userId: user.id,
    householdId: household.id,
    props: { milestone },
  });

  const label = fr.progress.streak.weeks(milestone).replace(/^d+ /, "");
  return new ImageResponse(
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: BG, color: INK, padding: "72px 72px 0", fontFamily: BODY,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", fontFamily: DISPLAY, fontSize: 44, textTransform: "uppercase" }}>
          <div
            style={{
              display: "flex", width: 80, height: 80, marginRight: 18, alignItems: "center", justifyContent: "center",
              background: VIOLET, color: BANANA, border: `6px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, fontSize: 52,
            }}
          >
            M
          </div>
          {fr.app.name}
        </div>
        <div
          style={{
            display: "flex", padding: "10px 18px", background: BANANA, border: `6px solid ${INK}`,
            boxShadow: `8px 8px 0 ${INK}`, transform: "rotate(4deg)", fontFamily: MONO, fontWeight: 700, fontSize: 24,
            textTransform: "uppercase", letterSpacing: 1.5,
          }}
        >
          {fr.progress.streak.shareUnlocked}
        </div>
      </div>

      <div
        style={{
          display: "flex", flexDirection: "column", margin: "0 8px", padding: "40px 48px 48px", background: VIOLET,
          color: "#ffffff", border: `6px solid ${INK}`, boxShadow: `20px 20px 0 ${INK}`, transform: "rotate(-2deg)",
        }}
      >
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 360, lineHeight: 0.8, letterSpacing: -25 }}>
          {milestone}
        </div>
        <div style={{ display: "flex", marginTop: 24, fontFamily: DISPLAY, fontSize: 96, lineHeight: 0.9, textTransform: "uppercase" }}>
          {label}
        </div>
      </div>

      <div style={{ display: "flex", position: "relative", height: 250 }}>
        <StampArt code={String(meals)} name="repas" bg={BANANA} size={190} rotate={-8} left={10} top={20} />
        <StampArt code="OK" name="fin prête" bg={GREEN} size={180} square rotate={5} left={215} top={40} />
        <StampArt code={String(milestone)} name="semaines" bg={BLUE} size={190} rotate={9} left={420} top={8} />
        <StampArt code="CQ" name="dimanche" bg={PEACH} size={180} square rotate={-6} left={630} top={44} />
      </div>

      <div
        style={{
          display: "flex", flexDirection: "column", margin: "0 -72px", padding: "36px 72px 44px", background: INK,
          color: BG, borderTop: `6px solid ${INK}`,
        }}
      >
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 40, lineHeight: 1.1, textTransform: "uppercase" }}>
          {fr.progress.streak.shareTagline}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontFamily: MONO, fontWeight: 700 }}>
          <div style={{ display: "flex", fontSize: 26, color: BANANA }}>finpret.app</div>
          <div style={{ display: "flex", fontSize: 22 }}>{meals} repas préparés le dimanche</div>
        </div>
      </div>
    </div>,
    { width: 1080, height: 1350, fonts: await shareFonts() },
  );
}
