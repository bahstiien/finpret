import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
const filters: [string, unknown][] = [];
let existing = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const q = {
          eq: (col: string, val: unknown) => (filters.push([col, val]), q),
          then: (resolve: (v: { count: number }) => unknown) => resolve({ count: existing }),
        };
        return q;
      },
      insert: async (row: Record<string, unknown>) => (inserted.push(row), { error: null }),
    }),
  }),
}));

import { trackEvent } from "@/server/events";

beforeEach(() => {
  inserted.length = 0;
  filters.length = 0;
  existing = 0;
});

describe("trackEvent", () => {
  it("enregistre un événement avec son compte, son foyer et ses propriétés", async () => {
    await trackEvent("week_generated", { userId: "u1", householdId: "h1", props: { week: "2027-01-04" } });
    expect(inserted).toEqual([
      { name: "week_generated", user_id: "u1", household_id: "h1", props: { week: "2027-01-04" } },
    ]);
  });
  it("n'enregistre qu'une fois par compte les événements uniques (signup)", async () => {
    existing = 1;
    await trackEvent("signup", { userId: "u1" });
    expect(inserted).toHaveLength(0);
    existing = 0;
    await trackEvent("signup", { userId: "u1" });
    expect(inserted).toHaveLength(1);
  });
  it("déduplique par clé : une semaine, un compte", async () => {
    existing = 1;
    await trackEvent("session_done", { userId: "u1", householdId: "h1", dedupeKey: "w1" });
    expect(inserted).toHaveLength(0);
    expect(filters).toContainEqual(["props->>key", "w1"]);
    existing = 0;
    await trackEvent("session_done", { userId: "u1", householdId: "h1", dedupeKey: "w1" });
    expect(inserted[0]).toMatchObject({ props: { key: "w1" } });
  });
});
