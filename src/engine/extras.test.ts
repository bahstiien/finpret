import { describe, expect, it } from "vitest";
import rawAisles from "../../seed/aisles.json";
import { EXTRAS } from "./extras-catalog";
import {
  classify,
  extrasOf,
  findExtra,
  habitsFrom,
  normalize,
  parseEntry,
  quickPicks,
  searchExtras,
} from "./extras";

const aisleKeys = new Set((rawAisles as [string, string][]).map(([k]) => k));

describe("bibliothèque des articles hors menu", () => {
  it("range chaque article dans un rayon existant, sans doublon de nom", () => {
    for (const e of EXTRAS) expect(aisleKeys.has(e.aisle), `${e.label} → ${e.aisle}`).toBe(true);
    const names = EXTRAS.map((e) => normalize(e.label));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    expect(EXTRAS.length).toBeGreaterThan(200);
  });

  it("couvre chaque rayon et en propose les incontournables d'abord", () => {
    for (const k of aisleKeys) expect(extrasOf(k).length, k).toBeGreaterThan(0);
    expect(extrasOf("bebe")[0]!.label).toBe("Couches");
  });
});

describe("recherche", () => {
  it("trouve sans accents, au pluriel comme au singulier, par le début des mots", () => {
    expect(searchExtras("yaourt")[0]!.label).toBe("Yaourts nature");
    expect(searchExtras("yaourts").map((s) => s.label)).toContain("Yaourts aux fruits");
    expect(searchExtras("creme fra")[0]!.label).toBe("Crème fraîche");
    expect(searchExtras("oeuf")[0]!.label).toBe("Œufs");
    expect(searchExtras("pq")[0]).toMatchObject({ label: "Papier toilette", aisle: "maison" });
    expect(searchExtras("couch")[0]).toMatchObject({ label: "Couches", aisle: "bebe" });
  });

  it("met en avant les habitudes du foyer avec leur rayon", () => {
    const habits = [{ label: "Yaourts au soja", aisle: "frais", count: 4 }];
    expect(searchExtras("yao", habits)[0]).toEqual({
      label: "Yaourts au soja",
      aisle: "frais",
      from: "habit",
    });
  });

  it("ne propose rien pour une saisie vide ou de simples mots de liaison", () => {
    expect(searchExtras("")).toEqual([]);
    expect(searchExtras("de la")).toEqual([]);
    expect(searchExtras("zzzz")).toEqual([]);
  });
});

describe("rayon d'un article saisi librement", () => {
  it("reprend le rayon de la bibliothèque, même avec un complément", () => {
    expect(classify("Yaourts vanille")).toBe("frais");
    expect(classify("Couches taille 4")).toBe("bebe");
    expect(classify("Gel douche bio")).toBe("maison");
    expect(classify("Pommes")).toBe("legumes");
    expect(classify("Bouteille de vin")).toBe("epicerie");
    expect(classify("Pain")).toBe("boulangerie");
  });

  it("ne se laisse plus piéger par un mot caché dans un autre", () => {
    expect(classify("Liquide vaisselle")).toBe("maison");
    expect(classify("Escalope de veau")).not.toBe("epicerie");
  });

  it("préfère le rayon où le foyer range déjà l'article", () => {
    expect(classify("Compotes", [{ label: "compotes", aisle: "frais", count: 1 }])).toBe("frais");
  });

  it("range dans « divers » ce qu'il ne reconnaît pas", () => {
    expect(classify("Truc inconnu")).toBe("divers");
  });
});

describe("saisie", () => {
  it("sépare la quantité du nom", () => {
    expect(parseEntry("6 yaourts")).toEqual({ label: "Yaourts", qty: "6" });
    expect(parseEntry("2 kg de pommes")).toEqual({ label: "Pommes", qty: "2 kg" });
    expect(parseEntry("Lait x6")).toEqual({ label: "Lait", qty: "6" });
    expect(parseEntry("3 paquets de chips")).toEqual({ label: "Chips", qty: "3 paquets" });
    expect(parseEntry("couches taille 4")).toEqual({ label: "Couches taille 4", qty: "" });
  });
});

describe("habitudes", () => {
  it("regroupe les ajouts par nom, garde le rayon le plus récent et trie par fréquence", () => {
    const h = habitsFrom([
      { label: "Compotes", aisle: "frais" },
      { label: "Lessive", aisle: "maison" },
      { label: "compotes", aisle: "epicerie" },
      { label: null, aisle: "divers" },
    ]);
    expect(h).toEqual([
      { label: "Compotes", aisle: "frais", count: 2 },
      { label: "Lessive", aisle: "maison", count: 1 },
    ]);
  });

  it("complète les habitudes par les incontournables", () => {
    const picks = quickPicks([{ label: "Bananes", aisle: "legumes", count: 3 }], 5);
    expect(picks).toHaveLength(5);
    expect(picks[0]!.from).toBe("habit");
    expect(picks.filter((p) => p.label === "Bananes")).toHaveLength(1);
  });

  it("varie les rayons des incontournables proposés d'emblée", () => {
    const aisles = new Set(quickPicks([], 8).map((p) => p.aisle));
    expect(aisles.size).toBe(8);
  });
});

describe("article connu", () => {
  it("reconnaît un nom ou une autre écriture", () => {
    expect(findExtra("pq")).toEqual({ label: "Papier toilette", aisle: "maison" });
    expect(findExtra("Yaourts nature")).toEqual({ label: "Yaourts nature", aisle: "frais" });
    expect(findExtra("yaou")).toBeNull();
  });
});
