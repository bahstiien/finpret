import { NextResponse } from "next/server";
import { getActiveHousehold, getUser, withSession } from "@/server/session";

/** Export JSON de toutes les données du foyer (RGPD, §4 et §6 Données), réservé à l'administrateur. */
export async function GET() {
  const user = await getUser();
  const household = user ? await getActiveHousehold() : null;
  if (!user || !household) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (household.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const hid = household.id;
  const data = await withSession(async (db) => {
    const members = await db.selectFrom("members").selectAll().where("household_id", "=", hid).execute();
    const memberIds = members.map((m) => m.id);
    return {
      household:
        (await db.selectFrom("households").selectAll().where("id", "=", hid).executeTakeFirst()) ?? null,
      memberships: await db
        .selectFrom("memberships")
        .select(["user_id", "role", "created_at"])
        .where("household_id", "=", hid)
        .execute(),
      members,
      presence: memberIds.length
        ? await db.selectFrom("presence_rules").selectAll().where("member_id", "in", memberIds).execute()
        : [],
      settings:
        (await db
          .selectFrom("household_settings")
          .selectAll()
          .where("household_id", "=", hid)
          .executeTakeFirst()) ?? null,
      weeks: await db
        .selectFrom("weeks")
        .selectAll()
        .where("household_id", "=", hid)
        .orderBy("start_date")
        .execute(),
      ratings: await db.selectFrom("ratings").selectAll().where("household_id", "=", hid).execute(),
      pantry: await db.selectFrom("pantry").selectAll().where("household_id", "=", hid).execute(),
      freezer: await db.selectFrom("freezer").selectAll().where("household_id", "=", hid).execute(),
      recipes: await db.selectFrom("recipes").selectAll().where("household_id", "=", hid).execute(),
      // Courses réelles : achats déclarés, signalements, préparations protégées, confirmations, adaptations.
      purchaseEvents: await db
        .selectFrom("purchase_events")
        .selectAll()
        .where("household_id", "=", hid)
        .orderBy("seq")
        .execute(),
      shoppingIssues: await db
        .selectFrom("shopping_issues")
        .selectAll()
        .where("household_id", "=", hid)
        .execute(),
      preparationStates: await db
        .selectFrom("preparation_states")
        .selectAll()
        .where("household_id", "=", hid)
        .execute(),
      coverageConfirmations: await db
        .selectFrom("coverage_confirmations")
        .selectAll()
        .where("household_id", "=", hid)
        .execute(),
      adaptationEvents: await db
        .selectFrom("adaptation_events")
        .selectAll()
        .where("household_id", "=", hid)
        .orderBy("created_at")
        .execute(),
    };
  });

  const body = { exportedAt: new Date().toISOString(), ...data };
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="foyer-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
