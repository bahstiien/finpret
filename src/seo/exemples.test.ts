import { describe, expect, it } from "vitest";
import { landingV2 } from "@/i18n/landing";
import { portionForAge } from "@/engine/portions";
import { RECIPES } from "./catalog";
import { DAYS, EXAMPLES, schedule } from "./exemples";
import { clamp, DESCRIPTION_MAX, fitTitle, TITLE_MAX } from "./meta";
import { seoPaths } from "./paths";

describe("exemples de semaine", () => {
  it("publie trois pages à slugs et titres uniques", () => {
    expect(EXAMPLES).toHaveLength(3);
    expect(new Set(EXAMPLES.map((e) => e.slug)).size).toBe(3);
    expect(new Set(EXAMPLES.map((e) => fitTitle(e.h1))).size).toBe(3);
    for (const e of EXAMPLES) expect(fitTitle(e.h1).length).toBeLessThanOrEqual(TITLE_MAX);
    expect(clamp("x".repeat(300), DESCRIPTION_MAX).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
  it("n'a aucun plat en commun entre deux pages", () => {
    const ids = EXAMPLES.flatMap((e) => e.slots.map((s) => s.recipe.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("a des introductions distinctes", () => {
    expect(new Set(EXAMPLES.map((e) => e.intro.join(" "))).size).toBe(3);
  });
  it("garde cinq dîners valables toute l'année, jamais un plat sans conservation possible", () => {
    for (const e of EXAMPLES) {
      expect(e.slots.map((s) => s.day)).toEqual([...DAYS]);
      for (const [i, s] of e.slots.entries()) {
        expect(s.recipe.seasonal).toBe(false);
        expect(s.recipe.months).toBeNull();
        if (s.from === "frigo") expect(s.recipe.fridgeDays!).toBeGreaterThanOrEqual(i + 1);
        else expect(s.recipe.freezable).toBe(true);
      }
      expect(schedule(e.slots.map((s) => s.recipe))).not.toBeNull();
    }
  });
  it("calcule les portions avec la règle du moteur", () => {
    const [couple, famille, veg] = EXAMPLES;
    expect(couple!.portions).toBe(2);
    expect(famille!.portions).toBe(2 + portionForAge(4) + portionForAge(9));
    expect(famille!.portions).toBe(3.25);
    expect(veg!.portions).toBe(2.5);
    expect(famille!.scale).toBe(3.25 / 4);
  });
  it("ne propose que du végétarien sur la page végétarienne", () => {
    const veg = EXAMPLES.find((e) => e.slug === "vegetarien")!;
    expect(veg.slots.every((s) => s.recipe.vegetarian)).toBe(true);
  });
  it("donne des courses sans placeholder ni quantité vide", () => {
    for (const e of EXAMPLES) {
      expect(e.shopping.length).toBeGreaterThan(0);
      for (const g of e.shopping)
        for (const it of g.items) expect(`${it.label}${it.qty}`).not.toMatch(/\{\w+\}|NaN|undefined/);
    }
  });
  it("a un goûter à faire avec les enfants seulement quand il y a des enfants", () => {
    for (const e of EXAMPLES) {
      expect(Boolean(e.snack)).toBe(e.household.childAges.length > 0);
      if (e.snack) expect(e.snack.kidTip).toBeTruthy();
    }
  });
  it("annonce sur l'accueil les volumes réels du catalogue", () => {
    const n = (label: string) => Number(landingV2.catalogue.items.find((i) => i.label === label)!.n.replace("+", ""));
    const kinds = (...k: string[]) => RECIPES.filter((r) => k.includes(r.kind)).length;
    expect(n("recettes de repas")).toBeLessThanOrEqual(kinds("plat", "soupe", "simple"));
    expect(n("goûters")).toBeLessThanOrEqual(kinds("gouter"));
  });
  it("entre au sitemap avec son URL canonique", () => {
    const paths = seoPaths().map((p) => p.path);
    for (const e of EXAMPLES) expect(paths).toContain(e.path);
  });
});
