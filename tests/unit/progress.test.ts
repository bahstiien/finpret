import { describe, expect, it } from "vitest";
import type { CookRecord } from "@/engine/passport";
import type { WeekPlan } from "@/engine/types";
import {
  cancelPause,
  closeDueWeeks,
  finishSession,
  lastClosableWeek,
  planPause,
  type NewAchievementRow,
  type ProgressStore,
  type StoredStreakWeek,
  type StoredWeek,
} from "@/server/progress";

const plan = (start: string, over: Partial<WeekPlan> = {}): WeekPlan => ({
  start,
  groups: [{ id: "g1", meals: [{ day: 1, meal: "dinner" }, { day: 2, meal: "lunch" }] }],
  soup: null,
  simples: [{ day: 5, id: "p1" }],
  bank: [], doubles: [], banked: false, removed: [], skip: [], cake: "", cm: 0, cs: 0, pastaNeed: 0,
  ...over,
});

const RECIPES: Record<string, { origin: string | null; kind: "main" | "soup" | "simple" }> = {
  g1: { origin: "jp", kind: "main" },
  p1: { origin: "mx", kind: "simple" },
};

function memoryStore(weeks: (StoredWeek & { householdId: string })[], tz = "Europe/Paris") {
  const doneAt = new Map<string, Date>();
  const cooks: { household: string; recipe: string; week: string; cookedOn: string; kind: string }[] = [];
  const ach: ({ household: string } & NewAchievementRow)[] = [];
  const streak = new Map<string, StoredStreakWeek>();
  const events: { name: string; props: Record<string, unknown> }[] = [];
  const store: ProgressStore = {
    timezone: async () => tz,
    week: async (id) => weeks.find((w) => w.id === id) ?? null,
    weeksBetween: async (h, from, to) =>
      weeks.filter((w) => w.householdId === h && w.startDate >= from && w.startDate <= to),
    setDoneAt: async (id, at) => {
      if (!doneAt.has(id)) doneAt.set(id, at);
      return doneAt.get(id)!;
    },
    upsertCooks: async (h, w, list) => {
      for (const c of list) {
        if (!cooks.some((x) => x.household === h && x.recipe === c.recipeId && x.week === w))
          cooks.push({ household: h, recipe: c.recipeId, week: w, cookedOn: c.cookedOn, kind: c.kind });
      }
    },
    cookRecords: async (h) =>
      cooks
        .filter((c) => c.household === h)
        .map((c): CookRecord => ({
          recipeId: c.recipe,
          cookedOn: c.cookedOn,
          kind: c.kind as CookRecord["kind"],
          origin: RECIPES[c.recipe]?.origin ?? null,
          isGlobal: true,
        })),
    achievements: async (h) => ach.filter((a) => a.household === h),
    insertAchievements: async (h, rows) => {
      for (const r of rows) if (!ach.some((a) => a.household === h && a.kind === r.kind && a.key === r.key)) ach.push({ household: h, ...r });
    },
    streakWeeks: async () => [...streak.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    putStreakWeek: async (_h, row, { overwrite }) => {
      if (overwrite || !streak.has(row.weekStart)) streak.set(row.weekStart, row);
    },
    removeStreakWeek: async (_h, ws) => void streak.delete(ws),
    householdsToClose: async () => ["h1"],
    track: async (name, _h, props) => void events.push({ name, props }),
  };
  return { store, cooks, ach, streak, events, doneAt };
}

const W = (n: number) => {
  const d = new Date(Date.UTC(2027, 0, 4 + 7 * n)); // lundi 4 janvier 2027 + n semaines
  const start = d.toISOString().slice(0, 10);
  return { id: `w${n}`, householdId: "h1", startDate: start, plan: plan(start) };
};

describe("finishSession", () => {
  it("inscrit le plat, le tampon pays et la semaine done ; un second appel ne double rien", async () => {
    const m = memoryStore([W(0)]);
    const at = new Date("2027-01-03T16:00:00Z"); // dimanche, veille de la semaine
    const r = await finishSession(m.store, { householdId: "h1", weekId: "w0", now: at });
    expect(r.stamps).toEqual([{ kind: "country", key: "jp" }]);
    expect(m.cooks).toHaveLength(1);
    expect(m.streak.get("2027-01-04")?.outcome).toBe("done");
    await finishSession(m.store, { householdId: "h1", weekId: "w0", now: new Date("2027-01-04T10:00:00Z") });
    expect(m.cooks).toHaveLength(1);
    expect(m.ach.filter((a) => a.kind === "country")).toHaveLength(1);
    expect(m.doneAt.get("w0")?.toISOString()).toBe(at.toISOString()); // première valeur conservée
  });

  it("une session terminée trop tard ne compte pas pour la série", async () => {
    const m = memoryStore([W(0)]);
    await finishSession(m.store, { householdId: "h1", weekId: "w0", now: new Date("2027-01-08T10:00:00Z") });
    expect(m.streak.size).toBe(0);
    expect(m.cooks).toHaveLength(1);
  });

  it("signale le palier 4 une seule fois", async () => {
    const m = memoryStore([W(0), W(1), W(2), W(3)]);
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await finishSession(m.store, {
          householdId: "h1",
          weekId: `w${i}`,
          now: new Date(Date.parse(`${W(i).startDate}T12:00:00Z`) - 86_400_000),
        }),
      );
    }
    expect(results.map((r) => r.milestone)).toEqual([null, null, null, 4]);
    expect(m.events.filter((e) => e.name === "streak_milestone")).toHaveLength(1);
  });
});

describe("closeDueWeeks", () => {
  it("pause automatique puis semaine manquée quand les jetons sont épuisés", async () => {
    const m = memoryStore([W(0), W(1), W(2), W(3), W(4)]);
    await finishSession(m.store, { householdId: "h1", weekId: "w0", now: new Date("2027-01-03T16:00:00Z") });
    // jeudi 11 mars : les semaines du 11 janvier au 8 février sont closes, aucune session
    const s = await closeDueWeeks(m.store, new Date("2027-02-11T09:00:00Z"));
    expect(s.paused).toBe(2);
    expect(s.missed).toBe(3); // 3e, 4e et 5e semaines : plus de jeton ce trimestre
    expect(m.streak.get("2027-01-11")).toMatchObject({ outcome: "paused", source: "auto" });
    expect(m.streak.get("2027-02-01")?.outcome).toBe("missed");
    const again = await closeDueWeeks(m.store, new Date("2027-02-11T10:00:00Z"));
    expect(again.closed).toBe(0); // idempotent
  });

  it("n'écrit rien avant la première semaine fin prête", async () => {
    const m = memoryStore([W(0), W(1)]);
    expect((await closeDueWeeks(m.store, new Date("2027-02-11T09:00:00Z"))).closed).toBe(0);
  });

  it("semaine sans plat à préparer : neutre", async () => {
    const weeks = [W(0), { ...W(1), plan: plan("2027-01-11", { groups: [], soup: null }) }];
    const m = memoryStore(weeks);
    await finishSession(m.store, { householdId: "h1", weekId: "w0", now: new Date("2027-01-03T16:00:00Z") });
    await closeDueWeeks(m.store, new Date("2027-01-14T09:00:00Z"));
    expect(m.streak.get("2027-01-11")?.outcome).toBe("neutral");
  });

  it("inscrit un soir simple passé, pas un soir retiré", async () => {
    const weeks = [W(0), { ...W(1), plan: plan("2027-01-11", { removed: ["5-dinner"] }) }];
    const m = memoryStore(weeks);
    await closeDueWeeks(m.store, new Date("2027-01-12T09:00:00Z"));
    expect(m.cooks.some((c) => c.week === "w1")).toBe(false); // soir retiré : rien d'inscrit
    expect(m.cooks.filter((c) => c.recipe === "p1").map((c) => c.week)).toEqual(["w0"]);
  });

  it("dernier lundi clos", () => {
    expect(lastClosableWeek("2027-02-10")).toBe("2027-02-01"); // mercredi : fenêtre encore ouverte
    expect(lastClosableWeek("2027-02-11")).toBe("2027-02-08"); // jeudi
  });
});

describe("pauses planifiées", () => {
  const now = new Date("2027-03-01T10:00:00Z");

  it("pose, plafonne à 2 par trimestre et se rend à l'annulation", async () => {
    const m = memoryStore([W(0)]);
    expect(await planPause(m.store, { householdId: "h1", weekStart: "2027-03-15", now })).toEqual({ ok: true });
    expect(await planPause(m.store, { householdId: "h1", weekStart: "2027-03-22", now })).toEqual({ ok: true });
    expect(await planPause(m.store, { householdId: "h1", weekStart: "2027-03-29", now })).toEqual({ ok: false, reason: "no_token" });
    // une semaine d'un autre trimestre a ses propres jetons
    expect(await planPause(m.store, { householdId: "h1", weekStart: "2027-04-05", now })).toEqual({ ok: true });
    expect(await cancelPause(m.store, { householdId: "h1", weekStart: "2027-03-15" })).toEqual({ ok: true });
    expect(await planPause(m.store, { householdId: "h1", weekStart: "2027-03-29", now })).toEqual({ ok: true });
  });

  it("refuse le passé, la semaine en cours et au-delà de 8 semaines", async () => {
    const m = memoryStore([]);
    expect(await planPause(m.store, { householdId: "h1", weekStart: "2027-03-01", now })).toMatchObject({ ok: false, reason: "past" });
    expect(await planPause(m.store, { householdId: "h1", weekStart: "2027-05-10", now })).toMatchObject({ ok: false, reason: "too_far" });
    expect(await planPause(m.store, { householdId: "h1", weekStart: "2027-03-16", now })).toMatchObject({ ok: false, reason: "past" });
  });

  it("une pause planifiée sur une semaine clôturée garde sa source", async () => {
    const m = memoryStore([W(0), W(1)]);
    await finishSession(m.store, { householdId: "h1", weekId: "w0", now: new Date("2027-01-03T16:00:00Z") });
    await planPause(m.store, { householdId: "h1", weekStart: "2027-01-11", now: new Date("2027-01-04T10:00:00Z") });
    await closeDueWeeks(m.store, new Date("2027-01-14T09:00:00Z"));
    expect(m.streak.get("2027-01-11")).toMatchObject({ outcome: "paused", source: "planned" });
    expect(m.streak.get("2027-01-11")?.closedAt).not.toBeNull();
  });
});
