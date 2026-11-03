import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { recipeAllergens } from "./catalog/derive";
import { generateWeek, weekRecipeIds } from "./compose";
import { createEnv } from "./env";
import { feedbackBias, isEmptyFeedback, NO_FEEDBACK, toggleFeedback } from "./feedback";
import { seededRandom } from "./random";
import { eligible, wshuffle } from "./season";
import { DEFAULT_MENU_SETTINGS, type Feedback, type Ratings } from "./types";

const settings = { ...DEFAULT_MENU_SETTINGS, noRepeatWeeks: 3 };

describe("retour rapide : gestes et corrections", () => {
  it("retoucher un signal le retire, et une fiche vide peut être supprimée", () => {
    let f = toggleFeedback(NO_FEEDBACK, "kids");
    expect(f.kids).toBe(true);
    f = toggleFeedback(f, "kids");
    expect(isEmptyFeedback(f)).toBe(true);
  });

  it("le temps et le goût sont indépendants", () => {
    const f = toggleFeedback(toggleFeedback(NO_FEEDBACK, "redo"), "long");
    expect(f).toEqual({ taste: 1, kids: false, long: true });
    expect(toggleFeedback(f, "long")).toEqual({ taste: 1, kids: false, long: false });
  });

  it("un refus efface « aimé des enfants », et aimer lève le refus", () => {
    const liked = toggleFeedback(NO_FEEDBACK, "kids");
    expect(toggleFeedback(liked, "refuse")).toEqual({ taste: -1, kids: false, long: false });
    const refused = toggleFeedback(NO_FEEDBACK, "refuse");
    expect(toggleFeedback(refused, "kids")).toEqual({ taste: null, kids: true, long: false });
  });
});

describe("retour rapide : effet sur le tirage", () => {
  const ids = LIB.mains.slice(0, 12).map((m) => m.id);
  const mean = (ratings: Ratings, feedback: Feedback, id: string) => {
    let sum = 0;
    const N = 300;
    for (let seed = 1; seed <= N; seed++) {
      const env = createEnv({ lib: LIB, random: seededRandom(seed), ratings, feedback });
      const pool = env.lib.mains.filter((r) => ids.includes(r.id));
      sum += wshuffle(env, pool).findIndex((r) => r.id === id);
    }
    return sum / N;
  };

  it("« à refaire » et « aimé des enfants » remontent un plat, « trop long » l'espace", () => {
    const id = ids[5]!;
    const neutral = mean({}, {}, id);
    expect(mean({ [id]: 1 }, {}, id)).toBeLessThan(neutral);
    expect(mean({}, { [id]: { kids: true } }, id)).toBeLessThan(neutral);
    expect(mean({}, { [id]: { long: true } }, id)).toBeGreaterThan(neutral);
  });

  it("« trop long » ne supprime pas le plat et ne pèse pas plus que le goût cumulé", () => {
    const env = createEnv({
      lib: LIB,
      random: seededRandom(1),
      ratings: { a: 1 },
      feedback: { a: { kids: true, long: true }, b: { long: true } },
    });
    expect(feedbackBias(env, "a")).toBeLessThan(0.1);
    expect(feedbackBias(env, "b")).toBeGreaterThan(0);
    expect(feedbackBias(env, "inconnu")).toBe(0);
  });

  it("un signal positif ne contourne jamais les allergies ni les ingrédients refusés", () => {
    const risky = [...LIB.mains, ...LIB.soups, ...LIB.simples].filter((r) =>
      recipeAllergens(Object.keys(r.ing)).includes("arachides"),
    );
    expect(risky.length).toBeGreaterThan(0);
    const ratings = Object.fromEntries(risky.map((r) => [r.id, 1 as const]));
    const feedback = Object.fromEntries(risky.map((r) => [r.id, { kids: true as const }]));
    for (let seed = 1; seed <= 15; seed++) {
      const env = createEnv({
        lib: LIB,
        random: seededRandom(seed),
        ratings,
        feedback,
        diet: { diet: "omnivore", allergens: ["arachides"], refused: [] },
      });
      const res = generateWeek({
        env,
        settings,
        start: "2027-03-01",
        previous: null,
        history: [],
        bank: [],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      const used = weekRecipeIds(res.week);
      for (const r of risky) expect(used).not.toContain(r.id);
    }
  });
});

describe("retour rapide : pas de répétition excessive", () => {
  it("un plat aimé ne revient jamais deux semaines de suite sur 12 semaines", () => {
    const liked = LIB.mains
      .filter((m) => eligible(createEnv({ lib: LIB, random: Math.random }), m, 3))
      .slice(0, 8);
    const ratings = Object.fromEntries(liked.map((r) => [r.id, 1 as const]));
    const feedback = Object.fromEntries(liked.map((r) => [r.id, { kids: true as const }]));
    for (const seed of [1, 7, 42]) {
      const env = createEnv({ lib: LIB, random: seededRandom(seed), ratings, feedback });
      const history: string[][] = [];
      for (let w = 0; w < 12; w++) {
        const res = generateWeek({
          env,
          settings,
          start: "2027-03-01",
          previous: null,
          history,
          bank: [],
        });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const ids = weekRecipeIds(res.week);
        // La semaine la plus récente est en tête de l'historique ; deux semaines bloquent un plat aimé.
        for (const prior of history.slice(0, 2)) {
          for (const id of ids) expect(prior).not.toContain(id);
        }
        history.unshift(ids);
      }
    }
  });
});
