import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { generateWeek } from "./compose";
import { createEnv } from "./env";
import { dailyAverages, dayTotals } from "./nutrition";
import { seededRandom } from "./random";
import { DEFAULT_MENU_SETTINGS } from "./types";

const week = (weekendBatch: boolean) => {
  const env = createEnv({ lib: LIB, random: seededRandom(4) });
  const res = generateWeek({
    env,
    settings: { ...DEFAULT_MENU_SETTINGS, weekendBatch },
    start: "2027-03-01",
    previous: null,
    history: [],
    bank: [],
  });
  if (!res.ok) throw new Error("génération impossible");
  return { env, w: res.week };
};

describe("nutrition de la semaine imprimable", () => {
  it("compte samedi et dimanche quand le week-end est préparé pendant la session", () => {
    const { env, w } = week(true);
    const tot = dayTotals(env, w);
    expect(tot[6]![0]).toBeGreaterThan(0);
    expect(tot[7]![0]).toBeGreaterThan(0);
    expect(dailyAverages(env, w).kcal).toBeGreaterThan(500);
  });

  it("compte les recettes du week-end cuisinées sur place", () => {
    const { env, w } = week(false);
    expect(dayTotals(env, w)[6]![0]).toBe(0);
    const simple = LIB.simples[0]!;
    const withFresh = { ...w, weekend: { "6-dinner": simple.id } };
    expect(dayTotals(env, withFresh)[6]![0]).toBe(simple.m[0]);
  });
});
