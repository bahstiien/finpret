import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import { isMilestone } from "@/engine/streak";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/server/events";
import { milestoneMeals } from "@/server/progress-share";
import { getActiveHousehold, getUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIOLET = "#7a5af8";
const BANANA = "#ffd23f";
const INK = "#17151f";

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
  const supabase = await createClient();
  const { data: reached } = await supabase
    .from("achievements")
    .select("key")
    .eq("household_id", household.id)
    .eq("kind", "streak");
  if (!(reached ?? []).some((a) => Number(a.key) >= milestone)) {
    return NextResponse.json({ error: "not_reached" }, { status: 403 });
  }

  const meals = await milestoneMeals(household.id, milestone);
  await trackEvent("share_card_created", {
    userId: user.id,
    householdId: household.id,
    props: { milestone },
  });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        background: VIOLET,
        color: "#ffffff",
        padding: 96,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 140,
          height: 140,
          borderRadius: 40,
          background: "#ffffff",
          color: VIOLET,
          fontSize: 96,
          fontWeight: 900,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        M
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ display: "flex", fontSize: 360, fontWeight: 900, lineHeight: 1 }}>{milestone}</div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 900, marginTop: 8 }}>
          {fr.progress.streak.weeks(milestone).replace(/^\d+ /, "")}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 64,
            padding: "24px 48px",
            borderRadius: 999,
            background: BANANA,
            color: INK,
            fontSize: 48,
            fontWeight: 800,
          }}
        >
          {meals} repas préparés le dimanche
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700, opacity: 0.9 }}>{fr.app.name}</div>
    </div>,
    { width: 1080, height: 1350 },
  );
}
