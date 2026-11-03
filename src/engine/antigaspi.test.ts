import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { daysLeft, impactOf, isUrgent, pantrySaves, urgencyBonus } from "./antigaspi";
import { createEnv } from "./env";
import { seededRandom } from "./random";
import { pantryScore, wshuffle } from "./season";

describe("anti-gaspi", () => {
  it("compte les jours avant la date limite", () => {
    expect(daysLeft("2027-01-08", "2027-01-04")).toBe(4);
    expect(daysLeft("2027-01-04", "2027-01-04")).toBe(0);
    expect(daysLeft("2027-01-02", "2027-01-04")).toBe(-2);
    expect(isUrgent("2027-01-09", "2027-01-04")).toBe(true);
    expect(isUrgent("2027-01-10", "2027-01-04")).toBe(false);
    expect(isUrgent(undefined, "2027-01-04")).toBe(false);
  });

  it("donne un bonus plus fort quand la date approche", () => {
    expect(
      urgencyBonus({ creme: "2027-01-05", feta: "2027-01-08", courgette: "2027-01-20", oeufs: "2027-01-01" }, "2027-01-04"),
    ).toEqual({ creme: 1.5, feta: 0.75, oeufs: 1.5 });
  });

  it("ajoute le bonus au poids du garde-manger, sans rien changer sans date", () => {
    const recipe = { ing: { creme: 200, courgette: 2 } };
    const plain = createEnv({ lib: LIB, pantry: { creme: 200 }, random: seededRandom(1) });
    const urgent = createEnv({ lib: LIB, pantry: { creme: 200 }, urgency: { creme: 1.5 }, random: seededRandom(1) });
    expect(pantryScore(plain, recipe)).toBe(1);
    expect(pantryScore(urgent, recipe)).toBe(2.5);
    // Le bonus ne compte que pour un ingrédient encore au garde-manger.
    const gone = createEnv({ lib: LIB, pantry: {}, urgency: { creme: 1.5 }, random: seededRandom(1) });
    expect(pantryScore(gone, recipe)).toBe(0);
  });

  it("fait remonter les recettes qui écoulent un ingrédient à date courte", () => {
    // Crème et feta au garde-manger, même poids : la date courte de la crème la fait passer devant.
    const mains = LIB.mains.filter((r) => !r.ing.creme !== !r.ing.feta);
    expect(mains.some((r) => r.ing.creme) && mains.some((r) => r.ing.feta)).toBe(true);
    const cremeFirst = (urgency: Record<string, number>) => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const env = createEnv({ lib: LIB, pantry: { creme: 200, feta: 200 }, urgency, random: seededRandom(seed) });
        if (wshuffle(env, mains)[0]!.ing.creme) n++;
      }
      return n;
    };
    expect(cremeFirst({ creme: 1.5 })).toBe(40);
    expect(cremeFirst({})).toBeLessThan(40);
  });

  it("liste les ingrédients pris dans le stock par la semaine", () => {
    const saves = pantrySaves(
      LIB,
      { creme: 150, feta: null, courgette: 3, riz: 500, oeufs: 0 },
      { creme: "2027-01-06" },
      { creme: 200, feta: 100, courgette: 2, riz: 300, oeufs: 4, lardons: 200 },
      "2027-01-04",
    );
    expect(saves).toEqual([
      { k: "courgette", qty: 2, urgent: false },
      { k: "creme", qty: 150, urgent: true },
      { k: "feta", qty: null, urgent: false },
    ]);
  });

  it("additionne l'impact en grammes sans convertir les pièces", () => {
    expect(
      impactOf(LIB, [
        { k: "courgette", qty: 2, urgent: false },
        { k: "creme", qty: 150, urgent: true },
        { k: "feta", qty: 100.4, urgent: true },
        { k: "emmental", qty: null, urgent: false },
      ]),
    ).toEqual({ count: 4, urgent: 2, grams: 250 });
  });
});
