import { describe, expect, it } from "vitest";
import {
  absencesFrom,
  onboardingDefaults,
  onboardingSchema,
  plannedMeals,
  skipFromAnswers,
} from "./onboarding";

describe("onboarding : rythme", () => {
  it("« Oui » ne décoche rien, « Non » décoche les 5 jours, « Certains jours » les jours non retenus", () => {
    expect(skipFromAnswers({ lunch: "oui", lunchDays: [], dinner: "oui", dinnerDays: [] })).toEqual([]);
    expect(
      skipFromAnswers({ lunch: "non", lunchDays: [1], dinner: "certains", dinnerDays: [1, 2, 4] }),
    ).toEqual(["1-lunch", "2-lunch", "3-lunch", "4-lunch", "5-lunch", "3-dinner", "5-dinner"]);
  });

  it("une absence le midi couvre la semaine, seulement pour ce membre", () => {
    expect(
      absencesFrom([
        { lunch: false, dinner: false },
        { lunch: true, dinner: false },
      ]),
    ).toEqual([1, 2, 3, 4, 5].map((d) => ({ member: 1, slot: `${d}-lunch` })));
  });

  it("compte 10 repas par défaut, 4 de plus avec le week-end", () => {
    expect(plannedMeals([], false)).toBe(10);
    expect(plannedMeals(["1-lunch", "2-lunch"], true)).toBe(12);
  });

  it("les valeurs par défaut sont valides : un adulte, équilibré, sans objectif", () => {
    const d = onboardingDefaults("Camille");
    d.household.name = "Chez Camille";
    const parsed = onboardingSchema.parse(d);
    expect(parsed.household.members).toHaveLength(1);
    expect(parsed.diet).toEqual({ diet: "omnivore", allergens: [], refused: [], goals: [] });
    expect(
      onboardingSchema.safeParse({ ...d, diet: { ...d.diet, diet: "carnivore", goals: ["sportif"] } })
        .success,
    ).toBe(true);
  });
});
