import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { json } from "@/server/db";
import { createTestDb, type TestDb } from "./pglite-db";

/** Notifications `household_events` (temps réel, migration 20261108000000) : une par changement, à la validation. */
describe("household_events", () => {
  let db: TestDb;
  let householdId: string;
  let weekId: string;
  const received: { t: string; h: string; w: string | null }[] = [];

  beforeAll(async () => {
    db = await createTestDb();
    await db.listen("household_events", (payload) => received.push(JSON.parse(payload)));
    ({ householdId, weekId } = await db.admin(async (tx) => {
      const user = await tx
        .insertInto("auth.users")
        .values({ email: "temps-reel@test.fr" })
        .returning("id")
        .executeTakeFirstOrThrow();
      const household = await tx
        .insertInto("households")
        .values({ name: "Temps réel", created_by: user.id })
        .returning("id")
        .executeTakeFirstOrThrow();
      const week = await tx
        .insertInto("weeks")
        .values({ household_id: household.id, start_date: "2026-11-02", status: "draft", plan: json({}) })
        .returning("id")
        .executeTakeFirstOrThrow();
      return { householdId: household.id, weekId: week.id };
    }));
  }, 60_000);
  afterAll(() => db.close());

  const settle = () => new Promise((r) => setTimeout(r, 50));

  it("signale l'ajout, la coche et la suppression d'un article, avec son foyer et sa semaine", async () => {
    received.length = 0;
    const item = await db.admin((tx) =>
      tx
        .insertInto("shopping_items")
        .values({
          household_id: householdId,
          week_id: weekId,
          source: "manual",
          label: "Lessive",
          aisle: "divers",
        })
        .returning("id")
        .executeTakeFirstOrThrow(),
    );
    await db.admin((tx) =>
      tx.updateTable("shopping_items").set({ checked: true }).where("id", "=", item.id).execute(),
    );
    await db.admin((tx) => tx.deleteFrom("shopping_items").where("id", "=", item.id).execute());
    await settle();
    expect(received).toEqual([
      { t: "shopping_items", h: householdId, w: weekId },
      { t: "shopping_items", h: householdId, w: weekId },
      { t: "shopping_items", h: householdId, w: weekId },
    ]);
  });

  it("ne signale rien d'une transaction annulée", async () => {
    received.length = 0;
    await db
      .admin(async (tx) => {
        await tx
          .insertInto("shopping_items")
          .values({
            household_id: householdId,
            week_id: weekId,
            source: "manual",
            label: "Café",
            aisle: "divers",
          })
          .execute();
        throw new Error("annulée");
      })
      .catch(() => {});
    await settle();
    expect(received).toEqual([]);
  });

  it("signale aussi l'état de la session", async () => {
    received.length = 0;
    await db.admin((tx) =>
      tx.insertInto("sessions").values({ household_id: householdId, week_id: weekId }).execute(),
    );
    await settle();
    expect(received).toEqual([{ t: "sessions", h: householdId, w: weekId }]);
  });
});
