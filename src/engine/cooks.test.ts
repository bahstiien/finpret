import { describe, expect, it } from "vitest";
import { batchCooks, coveredMeals, hasBatch, simpleCooks } from "./cooks";
import type { WeekPlan } from "./types";

const plan = (over: Partial<WeekPlan> = {}): WeekPlan => ({
  start: "2027-02-08",
  groups: [
    {
      id: "g1",
      meals: [
        { day: 1, meal: "dinner" },
        { day: 2, meal: "lunch" },
      ],
    },
    {
      id: "g2",
      meals: [
        { day: 2, meal: "dinner" },
        { day: 3, meal: "lunch" },
      ],
    },
  ],
  soup: { id: "s1", days: [3, 4] },
  simples: [{ day: 5, id: "p1" }],
  bank: [],
  doubles: [],
  banked: false,
  removed: [],
  skip: [],
  cake: "",
  cm: 0,
  cs: 0,
  pastaNeed: 0,
  ...over,
});

describe("cooks", () => {
  it("inscrit les plats de batch et la soupe à la date de session", () => {
    expect(batchCooks(plan(), "2027-02-07")).toEqual([
      { recipeId: "g1", kind: "main", cookedOn: "2027-02-07" },
      { recipeId: "g2", kind: "main", cookedOn: "2027-02-07" },
      { recipeId: "s1", kind: "soup", cookedOn: "2027-02-07" },
    ]);
  });

  it("ignore un plat dont tous les repas sont retirés", () => {
    const p = plan({ removed: ["2-dinner", "3-lunch"] });
    expect(batchCooks(p, "2027-02-07").map((c) => c.recipeId)).toEqual(["g1", "s1"]);
  });

  it("un soir simple retiré n'est pas compté", () => {
    expect(simpleCooks(plan({ removed: ["5-dinner"] }), "2027-02-08", "2027-02-15")).toEqual([]);
  });

  it("un soir simple compte une fois son jour passé", () => {
    expect(simpleCooks(plan(), "2027-02-08", "2027-02-11")).toEqual([]);
    expect(simpleCooks(plan(), "2027-02-08", "2027-02-12")).toEqual([
      { recipeId: "p1", kind: "simple", cookedOn: "2027-02-12" },
    ]);
  });

  it("semaine sans batch ni soupe", () => {
    expect(hasBatch(plan({ groups: [], soup: null }))).toBe(false);
    expect(hasBatch(plan())).toBe(true);
  });

  it("repas couverts : un par créneau non retiré", () => {
    expect(coveredMeals(plan())).toBe(6);
    expect(coveredMeals(plan({ removed: ["1-dinner", "4-dinner"] }))).toBe(4);
  });
});
