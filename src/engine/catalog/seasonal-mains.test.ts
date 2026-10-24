import { describe, expect, it } from "vitest";
import { engineEnv } from "../../../tests/legacy/fixtures";
import { eligible } from "../season";
import { libraryFromSeed } from "./library";
import { rawSeed } from "./seed-files";
import { validateSeed } from "./validate";

// Bibliothèque complète (les fixtures de parité écartent ces plats, absents du prototype).
const fullLib = libraryFromSeed(validateSeed(rawSeed).seed!);

const SEASONS = {
  hv_: { name: "hiver", months: [12, 1, 2] },
  pr_: { name: "printemps", months: [3, 4, 5] },
  et_: { name: "été", months: [6, 7, 8] },
  au_: { name: "automne", months: [9, 10, 11] },
} as const;

describe("plats de saison ajoutés", () => {
  for (const [prefix, { name, months }] of Object.entries(SEASONS)) {
    const list = rawSeed.mains.filter((r) => r.id.startsWith(prefix));

    it(`${name} : 35 plats, dont 17 ou 18 végétariens, limités aux mois de la saison`, () => {
      expect(list).toHaveLength(35);
      expect([17, 18]).toContain(list.filter((r) => r.p === "veg").length);
      for (const r of list) expect(r.months).toEqual(months);
    });

    it(`${name} : éligibles au moteur chaque mois de la saison, jamais hors saison`, () => {
      const env = { ...engineEnv({ settings: {}, week: { start: "2027-01-04" } } as never, 1), lib: fullLib };
      const pool = env.lib.mains.filter((r) => r.id.startsWith(prefix));
      expect(pool).toHaveLength(35);
      for (let month = 1; month <= 12; month++) {
        const expected = (months as readonly number[]).includes(month);
        for (const r of pool) expect(eligible(env, r, month)).toBe(expected);
      }
    });
  }
});
