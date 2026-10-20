import { describe, expect, it } from "vitest";
import { frozenTooLong, pantryStep, weeksSince } from "./stock";

describe("stock", () => {
  it("adapte le pas du garde-manger à l'unité", () => {
    expect(pantryStep({ u: "g" }, 100)).toBe(50);
    expect(pantryStep({ u: "g" }, 500)).toBe(100);
    expect(pantryStep({ u: "ml" }, 1500)).toBe(250);
    expect(pantryStep({ u: "pc" }, 2)).toBe(1);
    expect(pantryStep({ u: "pc", half: true }, 2)).toBe(0.5);
    expect(pantryStep({ u: "cs" }, 2)).toBe(0.5);
    expect(pantryStep({ u: "boite" }, 2)).toBe(1);
  });

  it("signale un plat congelé depuis plus de 3 mois", () => {
    expect(frozenTooLong("2027-01-10", "2027-04-10")).toBe(false);
    expect(frozenTooLong("2027-01-10", "2027-04-11")).toBe(true);
    expect(weeksSince("2027-01-04", "2027-03-08")).toBe(9);
  });
});
