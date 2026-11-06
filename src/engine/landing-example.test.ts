import { describe, expect, it } from "vitest";
import { landingExample, landingV2 } from "@/i18n/landing";
import { RECIPES } from "@/seo/catalog";
import { libraryFromSeed } from "@/engine/catalog/library";
import { rawSeed } from "@/engine/catalog/seed-files";
import { validateSeed } from "@/engine/catalog/validate";
import { generateWeek } from "./compose";
import { createEnv } from "./env";
import { householdPortions, mealPd, portionForAge } from "./portions";
import { totals } from "./quantities";
import { seededRandom } from "./random";
import { buildSession } from "./session";
import { shoppingList } from "./shopping";
import { DEFAULT_MENU_SETTINGS, type Equipment } from "./types";
import { isRemoved, mealLabel } from "./week";

/**
 * La landing présente un exemple de semaine et des chiffres de catalogue. Ce test les régénère avec le vrai moteur :
 * si le moteur, le catalogue ou les réglages par défaut changent, la landing doit être mise à jour (ou le test
 * le dit). Aucun temps n'est « optimisé » : la durée affichée est celle de `buildSession`.
 */

const { seed } = validateSeed(rawSeed);
const lib = libraryFromSeed(seed!);

// Foyer de l'exemple : 2 adultes, 2 enfants (7 et 4 ans le 1er mars 2027), enfants à la cantine le midi en semaine.
const members = [
  { id: "a1", name: "A1", kind: "adult" as const },
  { id: "a2", name: "A2", kind: "adult" as const },
  { id: "c1", name: "C1", kind: "child" as const, birthdate: "2019-05-01" },
  { id: "c2", name: "C2", kind: "child" as const, birthdate: "2022-05-01" },
];
const presence = [1, 2, 3, 4, 5].flatMap((weekday) =>
  ["c1", "c2"].map((memberId) => ({
    memberId,
    weekday,
    meal: "lunch" as const,
    present: false,
    weekParity: "all" as const,
  })),
);
// Équipement par défaut des réglages (`equipmentSchema`) : pas d'air fryer ni de blender chauffant.
const equipment: Equipment = {
  ovenRacks: 2,
  burners: 4,
  airfryer: false,
  microwave: true,
  blender: false,
  mixer: false,
  standMixer: false,
  pressureCooker: false,
  freezer: true,
};

function weekFor(start: string, seed: number, level?: "beginner" | "confident") {
  const env = createEnv({ lib, pantry: {}, ratings: {}, random: seededRandom(seed) });
  const pm = householdPortions({ members, presence, weekStart: start });
  const result = generateWeek({
    env,
    settings: DEFAULT_MENU_SETTINGS,
    start,
    previous: null,
    bank: [],
    history: [[]],
  });
  if (!result.ok) throw new Error("semaine non générée");
  const week = result.week;
  const t = totals(env, week, pm, true);
  const session = buildSession({ env, week, pm, pantry: {}, totals: t, equipment, level });
  return { env, pm, week, session };
}

const plain = (s: string) => s.replace(/[  ]/g, " ");
const example = weekFor(landingExample.weekStart, 1);

describe("landing : catalogue", () => {
  it("annonce les vrais effectifs du catalogue, en comptes ronds", () => {
    const [recipes, snacks, breakfasts] = landingV2.catalogue.items;
    // Compte rond par défaut : à la centaine au-delà de 100, sinon à la dizaine (521 → « 500+ »).
    const round = (n: number) => `${n - (n % (n >= 100 ? 100 : 10))}+`;
    // Recettes distinctes par nom (le seed contient un doublon exact), comme le catalogue public.
    const kinds = (...k: string[]) => RECIPES.filter((r) => k.includes(r.kind)).length;
    expect(recipes.n).toBe(round(kinds("plat", "soupe", "simple")));
    expect(snacks.n).toBe(round(kinds("gouter")));
    expect(breakfasts.n).toBe(round(seed!.breakfasts.length));
  });
});

describe("landing : exemple de semaine", () => {
  const { env, pm, week, session } = example;

  it("10 repas = 10 créneaux couverts par 5 recettes (4 plats et 1 soupe)", () => {
    const slots = [
      ...week.groups.flatMap((g) => g.meals),
      ...(week.soup?.days ?? []).map((day) => ({ day, meal: "dinner" as const })),
      ...week.simples.map((s) => ({ day: s.day, meal: "dinner" as const })),
      ...week.bank,
    ].filter((m) => !isRemoved(week, m.day, m.meal));
    expect(slots).toHaveLength(landingExample.meals);
    expect(new Set(slots.map((m) => `${m.day}-${m.meal}`)).size).toBe(landingExample.meals);
    expect(week.groups.length + (week.soup ? 1 : 0)).toBe(landingExample.recipes);
    expect(week.groups).toHaveLength(4);
    expect(week.simples).toHaveLength(0);
    expect(week.bank).toHaveLength(0);
  });

  it("recettes, repas couverts et portions identiques à la landing", () => {
    const rows = [
      ...week.groups.map((g) => ({
        name: env.mainById.get(g.id)!.s,
        meals: g.meals.map((m) => [mealLabel(week, m), mealPd(week, pm, m.day, m.meal)]),
      })),
      {
        name: env.soupById.get(week.soup!.id)!.s,
        meals: week.soup!.days.map((d) => [
          mealLabel(week, { day: d, meal: "dinner" }),
          mealPd(week, pm, d, "dinner"),
        ]),
      },
    ];
    expect(rows).toEqual(landingExample.recipesList.map((r) => ({ name: r.name, meals: r.meals })));
    const portions = rows.flatMap((r) => r.meals).reduce((sum, [, p]) => sum + (p as number), 0);
    expect(portions).toBe(landingExample.portions);
    // La landing affiche des personnes à table, pas des portions : 4 le soir (2 adultes + 0,75 + 0,5), 2 le midi.
    const pd = (ages: number[]) => 2 + ages.reduce((sum, a) => sum + portionForAge(a), 0);
    for (const [, p] of rows.flatMap((r) => r.meals)) expect([pd([]), pd([7, 4])]).toContain(p);
    expect(landingV2.hero.menuCard.people).toMatch(/^4\sà table$/); // mercredi soir : toute la famille
  });

  it("gestes du jour J : décongélation et plats décrits par les recettes", () => {
    const storage = session.steps.at(-1)!.tasks.join("\n");
    expect(storage).toContain("Bolognaise dinde-lentilles, jeudi midi : à sortir mercredi soir");
    expect(storage).toContain("Agneau confit-pommes de terre, vendredi soir : à sortir jeudi soir");
    expect(storage).toContain("Curry pois chiches-épinards, vendredi midi : à sortir jeudi soir");
    expect(storage.match(/à sortir/g)).toHaveLength(3);
    const jj = (id: string) => env.mainById.get(id)!.jj!;
    expect(jj("pates_saumon")).toMatch(/^Cuis .*pâtes, réchauffe la sauce.*fromage blanc/);
    expect(jj("x2_hp_bolognaise_dinde_lentilles")).toMatch(/^Réchauffe 2 min au micro-ondes/);
    expect(jj("x2_an_agneau_confit_pommes_de_terre")).toMatch(/^Réchauffe 2 min au micro-ondes/);
    expect(jj("x_curry_pois_chiches_epinards")).toMatch(/^Réchauffe 2 min au micro-ondes/);
    expect(env.soupById.get(week.soup!.id)!.jj).toMatch(/^Réchauffe, ajoute les pois chiches/);
    // La carte du hero reprend une recette de l'exemple.
    expect(landingV2.hero.menuCard.title).toBe(landingExample.recipesList[1]!.name);
  });

  it("courses : articles par rayon, identiques à la landing", () => {
    const { items } = shoppingList(env, week, pm, {}, true, []);
    const labelOf = Object.fromEntries(lib.aisles);
    const byAisle = new Map<string, string[]>();
    for (const i of items) {
      const aisle = labelOf[i.aisle]!;
      byAisle.set(aisle, [...(byAisle.get(aisle) ?? []), `${i.label} : ${i.qty}`]);
    }
    const fromLanding = new Map(landingExample.shopping.map((g) => [g.aisle, g.items.map(plain)]));
    expect(new Map([...byAisle].map(([k, v]) => [k, v.map(plain).sort()]))).toEqual(
      new Map([...fromLanding].map(([k, v]) => [k, [...v].sort()])),
    );
    expect(items).toHaveLength(landingExample.shopping.reduce((n, g) => n + g.items.length, 0));
    expect(items).toHaveLength(20);
  });

  it("session : durée estimée, niveau débutant, portionnage et rangement", () => {
    expect(session.total).toBe(landingExample.sessionMinutes);
    expect(weekFor(landingExample.weekStart, 1, "beginner").session.total).toBe(
      landingExample.beginnerMinutes,
    );
    const starts = new Set(session.steps.map((s) => s.start));
    for (const s of landingExample.sessionSteps) expect(starts.has(s.at)).toBe(true);
    const portioning = session.steps.find((s) => s.name === "Portionnage")!;
    expect(portioning.tasks.join(" ").match(/1 boîte de/g)).toHaveLength(landingExample.boxes);
    const storage = session.steps.at(-1)!.tasks;
    const count = (prefix: string) => storage.find((t) => t.startsWith(prefix))!.split(" ; ").length;
    expect(count("Au frigo")).toBe(landingExample.fridgeMeals);
    expect(count("Au congélateur")).toBe(landingExample.freezerMeals);
    // La durée totale est la fin de cuisson plus 25 min de refroidissement, 15 de portionnage, 10 de rangement.
    expect(session.total).toBe(session.cook + 50);
    expect(session.steps.find((s) => s.name === "Refroidissement")!.timer?.minutes).toBe(25);
  });

  it("fourchette annoncée : estimations de 24 semaines générées pour ce foyer", () => {
    const totalsList = ["2027-03-01", "2027-06-07", "2027-10-04", "2027-01-04"].flatMap((start) =>
      [1, 2, 3, 4, 5, 6].map((n) => weekFor(start, n).session.total),
    );
    expect([Math.min(...totalsList), Math.max(...totalsList)]).toEqual([...landingExample.rangeMinutes]);
  });
});
