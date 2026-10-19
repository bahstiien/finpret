import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold, getUser } from "@/server/session";

/** Export JSON de toutes les données du foyer (RGPD, §4 et §6 Données), réservé à l'administrateur. */
export async function GET() {
  const user = await getUser();
  const household = user ? await getActiveHousehold() : null;
  if (!user || !household) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (household.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = await createClient();
  const hid = household.id;
  const [hh, memberships, members, settings, weeks, ratings, pantry, freezer, recipes] = await Promise.all([
    supabase.from("households").select("*").eq("id", hid).single(),
    supabase.from("memberships").select("user_id, role, created_at").eq("household_id", hid),
    supabase.from("members").select("*").eq("household_id", hid),
    supabase.from("household_settings").select("*").eq("household_id", hid).maybeSingle(),
    supabase.from("weeks").select("*").eq("household_id", hid).order("start_date"),
    supabase.from("ratings").select("*").eq("household_id", hid),
    supabase.from("pantry").select("*").eq("household_id", hid),
    supabase.from("freezer").select("*").eq("household_id", hid),
    supabase.from("recipes").select("*").eq("household_id", hid),
  ]);
  const memberIds = (members.data ?? []).map((m) => m.id);
  const presence = memberIds.length
    ? await supabase.from("presence_rules").select("*").in("member_id", memberIds)
    : { data: [] };

  const body = {
    exportedAt: new Date().toISOString(),
    household: hh.data,
    memberships: memberships.data,
    members: members.data,
    presence: presence.data,
    settings: settings.data,
    weeks: weeks.data,
    ratings: ratings.data,
    pantry: pantry.data,
    freezer: freezer.data,
    recipes: recipes.data,
  };
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="foyer-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
