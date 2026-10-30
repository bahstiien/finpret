import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./pglite-db";

let testDb: TestDb;

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  withAdmin: (fn: Parameters<TestDb["admin"]>[0]) => testDb.admin(fn),
}));

import { trackEvent } from "@/server/events";

const U1 = "00000000-0000-4000-8000-000000000001";
const H1 = "00000000-0000-4000-8000-0000000000a1";

const events = async () =>
  (await testDb.rows("events")).map(({ name, user_id, household_id, props }) => ({
    name,
    user_id,
    household_id,
    props,
  }));

beforeAll(async () => {
  testDb = await createTestDb();
}, 60_000);
afterAll(() => testDb.close());
beforeEach(() => testDb.admin((db) => db.deleteFrom("events").execute()));

describe("trackEvent", () => {
  it("enregistre un événement avec son compte, son foyer et ses propriétés", async () => {
    await trackEvent("week_generated", { userId: U1, householdId: H1, props: { week: "2027-01-04" } });
    expect(await events()).toEqual([
      { name: "week_generated", user_id: U1, household_id: H1, props: { week: "2027-01-04" } },
    ]);
  });
  it("n'enregistre qu'une fois par compte les événements uniques (signup)", async () => {
    await trackEvent("signup", { userId: U1 });
    await trackEvent("signup", { userId: U1 });
    expect(await events()).toHaveLength(1);
  });
  it("déduplique par clé : une semaine, un compte", async () => {
    await trackEvent("session_done", { userId: U1, householdId: H1, dedupeKey: "w1" });
    await trackEvent("session_done", { userId: U1, householdId: H1, dedupeKey: "w1" });
    expect(await events()).toHaveLength(1);
    expect((await events())[0]).toMatchObject({ props: { key: "w1" } });
    await trackEvent("session_done", { userId: U1, householdId: H1, dedupeKey: "w2" });
    expect(await events()).toHaveLength(2);
  });
});
