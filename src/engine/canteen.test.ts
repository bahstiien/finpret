import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { canteenDays, duplicateGroups, groupsOf, recipeGroups, splitByDate } from "./canteen";

describe("bases alimentaires (FOOD_GROUPS du prototype)", () => {
  it("détecte les bases par mots-clés", () => {
    expect(groupsOf("Coquillettes au jambon, yaourt")).toEqual(["pâtes", "porc"]);
    expect(groupsOf("Filet de colin, riz pilaf")).toEqual(["riz", "poisson"]);
    expect(groupsOf("Salade verte")).toEqual([]);
    expect(groupsOf(null)).toEqual([]);
  });

  it("lit les bases d'une recette par son nom et ses ingrédients", () => {
    const r = LIB.mains.find((m) => m.ing.patescompletes) ?? LIB.mains[0]!;
    expect(recipeGroups(LIB, r)).toContain("pâtes");
  });

  it("alerte quand la cantine et le dîner partagent une base", () => {
    const pastaDinner = { n: "Gratin de coquillettes", ing: { emmental: 100 } };
    expect(duplicateGroups(LIB, "Spaghetti bolognaise", pastaDinner)).toEqual(["pâtes"]);
    expect(duplicateGroups(LIB, "Poisson pané, purée", pastaDinner)).toEqual([]);
    expect(duplicateGroups(LIB, "Spaghetti", null)).toEqual([]);
  });
});

describe("jours de cantine", () => {
  const leo = { id: "leo", kind: "child" as const, archived: false };
  const lunchOff = (days: number[], parity: "all" | "A" | "B" = "all") =>
    days.map((d) => ({ memberId: "leo", weekday: d, meal: "lunch" as const, present: false, weekParity: parity }));

  it("midis de semaine où l'enfant est absent mais dîne à la maison", () => {
    expect(canteenDays(leo, lunchOff([1, 2, 4, 5]), "2026-10-19")).toEqual([1, 2, 4, 5]);
    expect(canteenDays({ ...leo, kind: "adult" }, lunchOff([1]), "2026-10-19")).toEqual([]);
  });

  it("garde alternée : pas de cantine la semaine chez l'autre parent", () => {
    const presence = [
      ...lunchOff([1, 2, 3, 4, 5], "A"),
      ...[1, 2, 3, 4, 5].flatMap((d) => [
        { memberId: "leo", weekday: d, meal: "lunch" as const, present: false, weekParity: "B" as const },
        { memberId: "leo", weekday: d, meal: "dinner" as const, present: false, weekParity: "B" as const },
      ]),
    ];
    expect(canteenDays(leo, presence, "2026-10-19", "2026-10-19")).toEqual([1, 2, 3, 4, 5]);
    expect(canteenDays(leo, presence, "2026-10-26", "2026-10-19")).toEqual([]);
  });
});

describe("découpage d'un menu par date", () => {
  it("lit les en-têtes « Lundi 19 octobre » et les jours fériés", () => {
    const text = `MENUS DU 19 AU 23 OCTOBRE
Lundi 19 octobre
Carottes râpées
Coquillettes bolognaise
Yaourt
Mardi 20 octobre
Filet de colin, riz
Mercredi 21 octobre : pas de cantine
Jeudi 22 octobre
Omelette, purée
Vendredi 23 octobre
Férié`;
    expect(splitByDate(text, "2026-10-20")).toEqual([
      { date: "2026-10-19", text: "Carottes râpées, Coquillettes bolognaise, Yaourt" },
      { date: "2026-10-20", text: "Filet de colin, riz" },
      { date: "2026-10-22", text: "Omelette, purée" },
    ]);
  });

  it("lit les dates numériques et choisit l'année la plus proche", () => {
    expect(splitByDate("lundi 4/01 : potage, lasagnes\nmardi 05/01 : poulet, frites", "2026-12-28")).toEqual([
      { date: "2027-01-04", text: "potage, lasagnes" },
      { date: "2027-01-05", text: "poulet, frites" },
    ]);
    expect(splitByDate("Le 12/10/2026 : pizza", "2026-10-01")).toEqual([{ date: "2026-10-12", text: "pizza" }]);
  });

  it("ignore les nombres qui ne sont pas des dates et les dates impossibles", () => {
    expect(splitByDate("2 œufs, 3 tomates", "2026-10-01")).toEqual([]);
    expect(splitByDate("lundi 31/02 : riz", "2026-10-01")).toEqual([]);
  });
});
