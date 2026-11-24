import { describe, expect, it } from "vitest";
import { equipmentOf } from "./equipment";

describe("equipmentOf", () => {
  it("met les modes de cuisson d'abord, puis les ustensiles des étapes, sans doublon", () => {
    expect(
      equipmentOf(["four", "feu", "plan"], ["Poêle le poulet.", "Enfourne au four 20 min.", "Égoutte les pâtes."]),
    ).toEqual(["plaques de cuisson", "four", "poêle", "passoire"]);
  });

  it("ignore les faux amis : fromage râpé, moules marinières", () => {
    expect(equipmentOf([], ["Ajoute le fromage râpé.", "Sers les moules marinières."])).toEqual([]);
    expect(equipmentOf([], ["Râpe la carotte dans un saladier."])).toEqual(["saladier", "râpe"]);
  });
});
