import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { generateWeek } from "./compose";
import { createEnv } from "./env";
import { legacyPortions } from "./portions";
import { seededRandom } from "./random";
import { guessAisle, shoppingList, shoppingNeeds, shoppingText } from "./shopping";
import { DEFAULT_MENU_SETTINGS } from "./types";

describe("courses", () => {
  it("classe un article ajouté à la main comme le prototype", () => {
    expect(guessAisle("Lessive")).toBe("maison");
    expect(guessAisle("couches T4")).toBe("bebe");
    expect(guessAisle("Yaourts nature")).toBe("frais");
    expect(guessAisle("Pommes")).toBe("legumes");
    expect(guessAisle("Truc inconnu")).toBe("divers");
  });

  const env = createEnv({ lib: LIB, random: seededRandom(3) });
  const res = generateWeek({
    env,
    settings: DEFAULT_MENU_SETTINGS,
    start: "2027-03-01",
    previous: null,
    history: [],
    bank: [],
  });
  const week = res.ok ? res.week : null;

  it("liste les articles du menu sans le placard, sauf ce qui est coché à acheter", () => {
    const { items, baseUsed } = shoppingList(env, week!, legacyPortions(), {}, true, []);
    expect(items.length).toBeGreaterThan(5);
    expect(items.every((i) => LIB.ingredients[i.key]!.c !== "base")).toBe(true);
    expect(baseUsed.length).toBeGreaterThan(0);
    const oil = baseUsed[0]!;
    const withBase = shoppingList(env, week!, legacyPortions(), {}, true, [oil.key]);
    expect(withBase.items.find((i) => i.key === oil.key)?.aisle).not.toBe("base");
    for (const i of items) expect(i.qty).not.toMatch(/undefined|NaN/);
  });

  it("le garde-manger réduit la liste et « assez » retire l'article", () => {
    const { items } = shoppingList(env, week!, legacyPortions(), {}, true, []);
    const first = items[0]!;
    const after = shoppingList(env, week!, legacyPortions(), { [first.key]: null }, true, []);
    expect(after.items.find((i) => i.key === first.key)).toBeUndefined();
    expect(after.covered).toContain(first.key);
  });

  it("expose les besoins numériques par ingrédient, sans le placard", () => {
    const needs = shoppingNeeds(env, week!, legacyPortions(), {}, true);
    const keys = Object.keys(needs);
    expect(keys.length).toBeGreaterThan(5);
    for (const k of keys) {
      expect(LIB.ingredients[k]!.c).not.toBe("base");
      expect(Number.isFinite(needs[k]!.need)).toBe(true);
    }
    const first = keys[0]!;
    expect(shoppingNeeds(env, week!, legacyPortions(), { [first]: 50 }, true)[first]!.stock).toBe(50);
  });

  it("exporte les articles non cochés dans l'ordre des rayons", () => {
    const out = shoppingText(
      "Courses",
      [
        { aisle: "epicerie", text: "Riz", checked: false },
        { aisle: "viande", text: "Poulet", checked: false },
        { aisle: "frais", text: "Lait", checked: true },
      ],
      ["viande", "frais", "epicerie"],
      true,
    );
    expect(out.text).toBe("Courses\n- [ ] Poulet\n- [ ] Riz");
    expect(out.count).toBe(2);
  });
});
