import { describe, expect, it } from "vitest";
import { buildCountries, buildFrise, buildSeasons } from "./progress-view";

const catalog = [
  { id: "a", name: "Ramen", origin: "jp", kind: "main" },
  { id: "b", name: "Soupe miso", origin: "jp", kind: "soup" },
  { id: "c", name: "Tacos", origin: "mx", kind: "simple" },
  { id: "d", name: "Brioche", origin: "fr", kind: "cake" },
  { id: "e", name: "Pizza", origin: "it", kind: "main" },
  { id: "f", name: "Bowl", origin: null, kind: "main" },
];

describe("buildCountries", () => {
  it("un tampon par pays du catalogue, hors goûters et sans origine", () => {
    expect(buildCountries(catalog, []).map((c) => c.code)).toEqual(["it", "jp", "mx"]);
  });

  it("obtenus d'abord par date, puis vides par ordre alphabétique", () => {
    const list = buildCountries(catalog, [
      { recipeId: "c", cookedOn: "2027-03-01" },
      { recipeId: "a", cookedOn: "2027-02-01" },
    ]);
    expect(list.map((c) => c.code)).toEqual(["jp", "mx", "it"]);
    expect(list[0]).toMatchObject({ label: "Japon", total: 2, earned: true });
    expect(list[0]?.cooked).toEqual([{ id: "a", name: "Ramen", on: "2027-02-01" }]);
    expect(list[0]?.remaining).toEqual([{ id: "b", name: "Soupe miso" }]);
  });

  it("un pays ajouté au catalogue apparaît comme tampon vide", () => {
    const list = buildCountries([...catalog, { id: "z", name: "Kimchi", origin: "kr", kind: "main" }], []);
    expect(list.find((c) => c.code === "kr")).toMatchObject({ earned: false, total: 1 });
  });
});

describe("buildSeasons", () => {
  it("huit saisons : année précédente et année en cours", () => {
    const s = buildSeasons(
      "2027-10-05",
      new Map([
        ["2027-autumn", 6],
        ["2026-winter", 2],
      ]),
      new Set(),
    );
    expect(s).toHaveLength(8);
    expect(s[0]?.key).toBe("2026-winter");
    expect(s.find((x) => x.key === "2027-autumn")?.earned).toBe(true);
    expect(s.find((x) => x.key === "2026-winter")).toMatchObject({ count: 2, earned: false });
  });

  it("décembre appartient à l'hiver de l'année suivante", () => {
    expect(buildSeasons("2026-12-20", new Map(), new Set()).at(-1)?.key).toBe("2027-autumn");
  });
});

describe("buildFrise", () => {
  it("12 semaines, la semaine en cours en dernier, none avant la série", () => {
    const f = buildFrise(
      [
        { weekStart: "2027-02-01", outcome: "done" },
        { weekStart: "2027-02-08", outcome: "paused" },
      ],
      "2027-02-15",
      "todo",
    );
    expect(f).toHaveLength(12);
    expect(f.at(-1)).toEqual({ weekStart: "2027-02-15", current: true, state: "todo" });
    expect(f.at(-2)?.state).toBe("paused");
    expect(f.at(-3)?.state).toBe("done");
    expect(f[0]?.state).toBe("none");
  });
});
