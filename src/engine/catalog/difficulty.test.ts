import { describe, expect, it } from "vitest";
import { estimateDifficulty } from "./difficulty";
import { rawSeed } from "./seed-files";

describe("difficulté des recettes", () => {
  it("un plat à un seul geste est très facile", () => {
    expect(estimateDifficulty({ prepMin: 5, blocks: [{ mode: "four", active: 5 }] })).toBe(1);
  });

  it("plusieurs cuissons menées de front montent le niveau", () => {
    const blocks = [
      { mode: "feu", active: 10 },
      { mode: "four", active: 5 },
      { mode: "airfryer", active: 5 },
      { mode: "plan", active: 5 },
    ];
    expect(estimateDifficulty({ prepMin: 15, blocks })).toBe(4);
  });

  it("une pâte levée est de niveau 4, le repos ne compte pas dans la durée active d'un goûter", () => {
    expect(estimateDifficulty({ tm: "3 h dont 2 h de pousse" })).toBe(4);
    expect(estimateDifficulty({ tm: "45 min dont 30 min de repos" })).toBe(2);
  });

  it("tout le seed porte un niveau de 1 à 4", () => {
    const all = [...rawSeed.mains, ...rawSeed.soups, ...rawSeed.simples, ...rawSeed.cakes] as { diff: number }[];
    for (const r of all) expect([1, 2, 3, 4]).toContain(r.diff);
  });
});
