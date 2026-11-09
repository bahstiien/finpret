import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { usageRange } from "@/lib/admin-usage";
import { addDays, todayIn } from "@/lib/dates";
import { json } from "@/server/db";
import { createTestDb, type TestDb } from "./pglite-db";

let testDb: TestDb;

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  withAdmin: (fn: Parameters<TestDb["admin"]>[0]) => testDb.admin(fn),
}));

import { usageData } from "@/server/admin-usage";

const today = todayIn("Europe/Paris");
const daysAgo = (n: number) => addDays(today, -n);
/** Midi heure de Paris (pas de bascule de jour quel que soit le fuseau du serveur). */
const at = (day: string, hour = 12) => `${day}T${String(hour - 1).padStart(2, "0")}:00:00Z`;

beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.admin(async (db) => {
    await db.insertInto("aisles").values({ key: "legumes", label: "Légumes", position: 1 }).execute();
    await db
      .insertInto("ingredients")
      .values([
        { key: "carotte", label: "Carotte", unit: "g", aisle: "legumes" },
        { key: "poireau", label: "Poireau", unit: "pc", aisle: "legumes" },
      ])
      .execute();
    await db
      .insertInto("recipes")
      .values([
        { id: "curry", kind: "main", data: json({ n: "Curry de légumes" }), origin: "in", protein: "veg" },
        { id: "tajine", kind: "main", data: json({ n: "Tajine" }), origin: "ma", protein: "volaille" },
        { id: "veloute", kind: "soup", data: json({ n: "Velouté" }), origin: "fr", protein: "veg" },
      ])
      .execute();

    const households: string[] = [];
    for (const name of ["A", "B"]) {
      const u = await db
        .insertInto("auth.users")
        .values({ email: `${name}@usage.test` })
        .returning("id")
        .executeTakeFirstOrThrow();
      const h = await db
        .insertInto("households")
        .values({ name, created_by: u.id })
        .returning("id")
        .executeTakeFirstOrThrow();
      households.push(h.id);
    }
    const [a, b] = households as [string, string];

    const week = async (household: string, start: string) =>
      (
        await db
          .insertInto("weeks")
          .values({ household_id: household, start_date: start, status: "active", plan: json({}) })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;
    const monday = (d: string) => addDays(d, 1 - (((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1));
    const wA1 = await week(a, monday(daysAgo(3)));
    const wA2 = await week(a, monday(daysAgo(10)));
    const wB1 = await week(b, monday(daysAgo(3)));
    const wOld = await week(b, monday(daysAgo(45)));

    await db
      .insertInto("sessions")
      .values([
        // 1 h puis 2 h : médiane 90 min.
        {
          week_id: wA1,
          household_id: a,
          started_at: at(daysAgo(2), 10),
          done_at: at(daysAgo(2), 11),
          tasks_done: json({}),
        },
        {
          week_id: wA2,
          household_id: a,
          started_at: at(daysAgo(9)),
          done_at: at(daysAgo(9), 14),
          tasks_done: json({}),
        },
        // Démarrée il y a 3 jours, jamais terminée.
        { week_id: wB1, household_id: b, started_at: at(daysAgo(3)), tasks_done: json({}) },
        // Période précédente.
        {
          week_id: wOld,
          household_id: b,
          started_at: at(daysAgo(44)),
          done_at: at(daysAgo(44), 13),
          tasks_done: json({}),
        },
      ])
      .execute();

    await db
      .insertInto("recipe_cooks")
      .values([
        { household_id: a, recipe_id: "curry", week_id: wA1, kind: "main", cooked_on: daysAgo(2) },
        { household_id: a, recipe_id: "curry", week_id: wA2, kind: "main", cooked_on: daysAgo(9) },
        { household_id: a, recipe_id: "veloute", week_id: wA1, kind: "soup", cooked_on: daysAgo(2) },
        { household_id: b, recipe_id: "tajine", week_id: wOld, kind: "main", cooked_on: daysAgo(44) },
      ])
      .execute();

    await db
      .insertInto("ratings")
      .values([
        { household_id: a, recipe_id: "curry", value: 1, kids_liked: true },
        { household_id: b, recipe_id: "curry", value: 1 },
        { household_id: b, recipe_id: "tajine", value: -1 },
        { household_id: a, recipe_id: "veloute", value: null, too_long: true },
      ])
      .execute();

    await db
      .insertInto("pantry_saves")
      .values([
        {
          household_id: a,
          week_id: wA1,
          ingredient_key: "carotte",
          qty: 200,
          urgent: true,
          saved_on: daysAgo(2),
        },
        { household_id: a, week_id: wA2, ingredient_key: "carotte", qty: 100, saved_on: daysAgo(9) },
        { household_id: a, week_id: wA1, ingredient_key: "poireau", qty: null, saved_on: daysAgo(2) },
      ])
      .execute();

    await db
      .insertInto("events")
      .values([
        { name: "week_generated", created_at: at(daysAgo(1)) },
        { name: "week_generated", created_at: at(daysAgo(5)) },
        { name: "week_generated", created_at: at(daysAgo(40)) },
      ])
      .execute();
  });
}, 60_000);
afterAll(() => testDb.close());

describe("données d'usage du back-office", () => {
  it("compte les sessions terminées, la durée médiane et la période précédente", async () => {
    const { sessions } = await usageData(usageRange("30", today));
    expect(sessions).toMatchObject({
      done: 2,
      donePrev: 1,
      started: 3,
      abandoned: 1,
      households: 1,
      householdsPrev: 1,
      medianMinutes: 90,
      menus: 4,
    });
    expect(sessions.series.reduce((s, r) => s + r.n, 0)).toBe(2);
    expect(sessions.weekdays.reduce((s, r) => s + r.n, 0)).toBe(2);
  });

  it("compte les recettes cuisinées par type, origine et recette", async () => {
    const { cooks } = await usageData(usageRange("30", today));
    expect(cooks).toMatchObject({ total: 3, prev: 1, distinct: 2, imported: 0, catalog: 3 });
    expect(cooks.byKind).toEqual(
      expect.arrayContaining([
        { kind: "main", n: 2 },
        { kind: "soup", n: 1 },
      ]),
    );
    expect(cooks.byProtein).toEqual([{ protein: "veg", n: 3 }]);
    expect(cooks.top[0]).toMatchObject({ id: "curry", name: "Curry de légumes", n: 2, households: 1 });
  });

  it("agrège les avis par recette, depuis le début", async () => {
    const { ratings } = await usageData(usageRange("30", today));
    expect(ratings).toMatchObject({
      total: 4,
      households: 2,
      cookingHouseholds: 2,
      liked: 2,
      refused: 1,
      kids: 1,
      tooLong: 1,
    });
    expect(ratings.opinions.find((o) => o.id === "curry")).toMatchObject({ liked: 2, kids: 1, cookedBy: 1 });
    expect(ratings.opinions.find((o) => o.id === "tajine")).toMatchObject({ refused: 1, cookedBy: 1 });
  });

  it("compte l'anti-gaspi et les événements d'engagement", async () => {
    const d = await usageData(usageRange("30", today));
    expect(d.antigaspi).toEqual({
      saves: 3,
      urgent: 1,
      households: 1,
      top: [
        { label: "Carotte", n: 2 },
        { label: "Poireau", n: 1 },
      ],
    });
    expect(d.events).toEqual([{ name: "week_generated", n: 2, prev: 1 }]);
  });
});
