import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIB } from "../../../tests/legacy/fixtures";
import { cakeSchema, type Main, mainSchema, simpleSchema, soupSchema } from "../catalog/schema";
import { generateWeek } from "../compose";
import { createEnv } from "../env";
import { seededRandom } from "../random";
import { DEFAULT_MENU_SETTINGS } from "../types";
import { buildDraft, convert, quality, vegMonths } from "./classify";
import { parseIngredientLine } from "./ingredient-line";
import { extractRecipe, mainText } from "./jsonld";
import { BUILTIN_SYNONYMS, dice, matchIngredient, normalize } from "./match";
import { draftToForm, fromRecipe, importFormSchema, toRecipe } from "./to-recipe";
import { isoMinutes, parseYield } from "./units";
import { checkUrl, isPrivateIp, siteName, urlFromShare } from "./url";

const fixture = (name: string) => readFileSync(`tests/fixtures/import/${name}.html`, "utf8");
const FIXTURES = ["marmiton", "750g", "cuisineaz", "journaldesfemmes", "wordpress-wprm"] as const;

describe("validation des liens (SSRF)", () => {
  it.each([
    ["http://192.168.1.10/recette", "private"],
    ["http://10.0.0.1/", "private"],
    ["http://127.0.0.1:3000/", "private"],
    ["http://localhost/recette", "private"],
    ["http://[::1]/", "private"],
    ["http://169.254.169.254/latest/meta-data", "private"],
    ["http://172.20.1.1/", "private"],
    ["http://box.local/", "private"],
    ["file:///etc/passwd", "scheme"],
    ["ftp://example.com/", "scheme"],
    ["javascript:alert(1)", "scheme"],
    ["pas une url", "invalid"],
    ["https://user:pass@example.com/", "invalid"],
  ])("refuse %s", (url, reason) => {
    expect(checkUrl(url)).toEqual({ ok: false, reason });
  });

  it("accepte les sites publics", () => {
    expect(checkUrl("https://www.marmiton.org/recettes/recette_poulet.aspx").ok).toBe(true);
    expect(checkUrl(" http://8.8.8.8/ ").ok).toBe(true);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateIp("fd12::1")).toBe(true);
  });

  it("lit le lien partagé et nomme le site", () => {
    expect(urlFromShare({ text: "Regarde ça https://www.750g.com/gratin.htm, miam" })).toBe(
      "https://www.750g.com/gratin.htm",
    );
    expect(urlFromShare({ url: "https://a.fr/x", text: "https://b.fr" })).toBe("https://a.fr/x");
    expect(siteName(new URL("https://www.marmiton.org/x"))).toBe("Marmiton");
    expect(siteName(new URL("https://blog.exemple.fr/x"))).toBe("blog.exemple.fr");
    expect(siteName(new URL("https://blog.exemple.fr/x"), "Le blog")).toBe("Le blog");
  });
});

describe("durées ISO 8601 et portions", () => {
  it.each([
    ["PT20M", 20],
    ["PT1H5M", 65],
    ["PT1H", 60],
    ["P0DT0H45M", 45],
    ["PT90S", 2],
    ["P1D", 1440],
    ["PT", null],
    ["20 min", null],
    [null, null],
  ])("isoMinutes(%s) = %s", (iso, min) => expect(isoMinutes(iso)).toBe(min));

  it.each([
    ["4", 4],
    [4, 4],
    ["4 personnes", 4],
    ["6-8 parts", 6],
    ["Pour 2 à 3 personnes", 2],
    ["1,5 litre", 1.5],
    ["une tarte", null],
    ["0", null],
    [null, null],
  ])("parseYield(%s) = %s", (raw, n) => expect(parseYield(raw)).toBe(n));
});

describe("conversions d'unités", () => {
  it("convertit vers les unités du catalogue", () => {
    expect(parseIngredientLine("1 l de lait")).toMatchObject({ qty: 1000, unit: "ml" });
    expect(parseIngredientLine("1,5 kg de pommes de terre")).toMatchObject({ qty: 1500, unit: "g" });
    expect(parseIngredientLine("2 verres d'eau")).toMatchObject({ qty: 400, unit: "ml" });
    expect(parseIngredientLine("3 dl de crème")).toMatchObject({ qty: 300, unit: "ml" });
    expect(convert(2, "cs", "ml")).toBe(30);
    expect(convert(1, "cc", "ml")).toBe(5);
    expect(convert(30, "ml", "cs")).toBe(2);
    expect(convert(2, "cs", "g")).toBe(30);
    expect(convert(250, "ml", "g")).toBe(250);
    expect(convert(3, null, "pc")).toBe(3);
    expect(convert(3, null, "g")).toBeNull();
    expect(convert(200, "ml", "pc")).toBeNull();
  });
});

/** Lignes réelles d'ingrédients (formes rencontrées sur les sites cités) et le résultat attendu. */
const LINES: [string, Partial<ReturnType<typeof parseIngredientLine>>][] = [
  ["2 c. à soupe d'huile d'olive", { qty: 2, unit: "cs", label: "huile d'olive" }],
  [
    "1 boîte de tomates pelées (400 g)",
    { qty: 1, unit: "boite", label: "tomates pelées", note: "400 g", alt: { qty: 400, unit: "g" } },
  ],
  ["3 gousses d'ail", { qty: 3, unit: null, pieceWord: "gousses", label: "ail" }],
  ["sel, poivre", { qty: null, toTaste: true }],
  ["Sel et poivre", { qty: null, toTaste: true }],
  ["Poivre du moulin", { qty: null, toTaste: true }],
  ["1 pincée de muscade", { toTaste: true, label: "muscade" }],
  ["Coriandre fraîche, au goût", { toTaste: true, label: "Coriandre fraîche" }],
  ["Huile de friture (facultatif)", { toTaste: true }],
  ["200g de farine", { qty: 200, unit: "g", label: "farine" }],
  ["20cl de crème liquide", { qty: 200, unit: "ml", label: "crème liquide" }],
  ["1,2 kg de blanc de poulet", { qty: 1200, unit: "g", label: "blanc de poulet" }],
  ["½ citron", { qty: 0.5, unit: null, label: "citron" }],
  ["1/2 cuillère à café de cumin", { qty: 0.5, unit: "cc", label: "cumin" }],
  ["1 1/2 tasse de riz", { qty: 375, unit: "ml", label: "riz" }],
  ["2 à 3 carottes", { qty: 2, label: "carottes" }],
  ["4-5 pommes de terre", { qty: 4, label: "pommes de terre" }],
  ["1 c.à.s de curry", { qty: 1, unit: "cs", label: "curry" }],
  ["1 c.à.c de cumin", { qty: 1, unit: "cc", label: "cumin" }],
  ["2 cs de sauce soja", { qty: 2, unit: "cs", label: "sauce soja" }],
  ["1 cc de sel", { qty: 1, unit: "cc", label: "sel" }],
  ["2 cuillères à soupe de farine", { qty: 2, unit: "cs", label: "farine" }],
  ["1 cuillère à café rase de bicarbonate", { qty: 1, unit: "cc" }],
  ["1 oignon, émincé", { qty: 1, label: "oignon", note: "émincé" }],
  ["1 oignon rouge", { qty: 1, label: "oignon rouge" }],
  ["Un oignon", { qty: 1, label: "oignon" }],
  ["deux échalotes", { qty: 2, label: "échalotes" }],
  ["4 tranches de jambon", { qty: 4, pieceWord: "tranches", label: "jambon" }],
  ["1 bouquet de persil", { qty: 1, pieceWord: "bouquet", label: "persil" }],
  [
    "1 morceau de gingembre frais (3 cm)",
    { qty: 1, pieceWord: "morceau", label: "gingembre frais", note: "3 cm" },
  ],
  ["1 sachet de levure chimique", { qty: 1, pieceWord: "sachet", label: "levure chimique" }],
  ["125 g beurre mou", { qty: 125, unit: "g", label: "beurre mou" }],
  ["1 oeuf", { qty: 1, label: "oeuf" }],
  ["3 œufs", { qty: 3, label: "œufs" }],
  ["50 cl de lait", { qty: 500, unit: "ml", label: "lait" }],
  ["1 l de bouillon de légumes", { qty: 1000, unit: "ml", label: "bouillon de légumes" }],
  ["40 cl de lait de coco", { qty: 400, unit: "ml", label: "lait de coco" }],
  ["100 g de gruyère râpé", { qty: 100, unit: "g", label: "gruyère râpé" }],
  ["1 potimarron (environ 1 kg)", { qty: 1, label: "potimarron", alt: { qty: 1000, unit: "g" } }],
  ["environ 300 g de champignons de Paris", { qty: 300, unit: "g", label: "champignons de Paris" }],
  ["1 pâte brisée", { qty: 1, label: "pâte brisée" }],
  ["2 boîtes de pois chiches", { qty: 2, unit: "boite", label: "pois chiches" }],
  ["1 verre de vin blanc", { qty: 200, unit: "ml", label: "vin blanc" }],
  ["150 g chocolat noir concass&eacute;", { qty: 150, unit: "g", label: "chocolat noir concassé" }],
  ["Quelques feuilles de basilic", { qty: null, toTaste: true }],
];

describe("analyse des lignes d'ingrédients", () => {
  it("couvre au moins 40 lignes réelles", () => expect(LINES.length).toBeGreaterThanOrEqual(40));
  it.each(LINES)("%s", (line, expected) => expect(parseIngredientLine(line)).toMatchObject(expected));
});

describe("rapprochement avec le catalogue", () => {
  it("normalise et compare", () => {
    expect(normalize("Pommes de terre")).toBe("pomme terre");
    expect(normalize("Œufs bio")).toBe("oeuf");
    expect(dice("tomate", "tomate")).toBe(1);
    expect(dice("tomate", "tomme")).toBeLessThan(0.85);
  });

  it("chaque synonyme pointe vers un ingrédient du catalogue", () => {
    for (const key of Object.values(BUILTIN_SYNONYMS)) expect(LIB.ingredients[key], key).toBeDefined();
  });

  it.each([
    ["Blanc de poulet", "poulet", "exact"],
    ["oignons", "oignon", "exact"],
    ["tomates pelées", "tomates", "synonym"],
    ["gruyère râpé", "emmental", "synonym"],
    ["huile d'olive", "huile", "exact"],
    ["crème fraîche épaisse", "creme", "synonym"],
    ["beurre mou", "beurre", "similarity"],
  ])("%s → %s (%s)", (label, key, method) => {
    expect(matchIngredient({ label }, LIB.ingredients)).toMatchObject({ key, method });
  });

  it("ne rapproche pas un ingrédient inconnu et propose 5 candidats", () => {
    const res = matchIngredient({ label: "graines de chia" }, LIB.ingredients);
    expect(res.key).toBeNull();
    expect(res.candidates).toHaveLength(5);
  });
});

describe("extraction des pages", () => {
  it.each(FIXTURES)("%s : recette trouvée", (name) => {
    const res = extractRecipe(fixture(name));
    expect(res?.recipe.name).toBeTruthy();
    expect(res?.recipe.ingredients.length).toBeGreaterThanOrEqual(8);
  });

  it("lit le JSON-LD, le @graph, un tableau et les microdonnées", () => {
    expect(extractRecipe(fixture("marmiton"))).toMatchObject({
      method: "jsonld",
      recipe: { siteName: "Marmiton", yield: "6 personnes" },
    });
    expect(extractRecipe(fixture("750g"))?.recipe.instructions).toHaveLength(2);
    expect(extractRecipe(fixture("cuisineaz"))?.recipe.instructions).toHaveLength(2);
    expect(extractRecipe(fixture("journaldesfemmes"))?.method).toBe("microdata");
    expect(extractRecipe(fixture("wordpress-wprm"))?.recipe.name).toBe("Cookies aux pépites de chocolat");
  });

  it("page sans recette : rien n'est extrait, le texte principal reste disponible", () => {
    expect(extractRecipe(fixture("no-recipe"))).toBeNull();
    expect(extractRecipe("<html><body>Rien</body></html>")).toBeNull();
    expect(extractRecipe('<script type="application/ld+json">{ cassé</script>')).toBeNull();
    const text = mainText(fixture("no-recipe"));
    expect(text).toContain("réservé aux abonnés");
    expect(text).not.toContain("Menu");
  });
});

describe("brouillon d'import", () => {
  const draft = (name: string) => {
    const { recipe } = extractRecipe(fixture(name))!;
    return buildDraft({
      recipe,
      url: `https://exemple.fr/${name}`,
      sourceName: recipe.siteName ?? name,
      lib: LIB,
    });
  };

  it("Marmiton : 4 portions, au moins 90 % d'ingrédients rapprochés, aucune étape d'origine", () => {
    const d = draft("marmiton");
    expect(d).toMatchObject({
      servings: 6,
      kind: "main",
      protein: "volaille",
      origin: "fr",
      fridge: 3,
      macros: [420, 38, 0, 0],
    });
    const q = quality(d.lines);
    expect(q.matched / q.total).toBeGreaterThanOrEqual(0.9);
    expect(d.lines.find((l) => l.key === "poulet")?.qty).toBe(800);
    expect(d.steps).toEqual([]);
    expect(JSON.stringify(d)).not.toContain("Texte de démonstration");
  });

  it("classe le type, la protéine, les pâtes, le four et la conservation", () => {
    expect(draft("750g")).toMatchObject({
      kind: "main",
      protein: "porc",
      pasta: true,
      comfort: true,
      oven: true,
      freeze: false,
    });
    expect(draft("cuisineaz")).toMatchObject({ kind: "soup", protein: "veg", servings: 4 });
    expect(draft("journaldesfemmes")).toMatchObject({ kind: "simple", origin: "in", servings: 2 });
    const cookies = draft("wordpress-wprm");
    expect(cookies).toMatchObject({ kind: "cake", origin: "us", oven: true });
    // Les goûters gardent les quantités d'origine.
    expect(cookies.lines.find((l) => l.key === "farine")?.qty).toBe(200);
  });

  it("lignes au goût en placard, conversions impossibles surlignées", () => {
    const d = draft("cuisineaz");
    expect(d.lines.find((l) => l.original === "Sel")).toMatchObject({
      toTaste: true,
      aisle: "base",
      uncertain: false,
      qty: null,
    });
    expect(d.lines.find((l) => l.key === "potimarron")).toMatchObject({
      qty: 1000,
      unit: "g",
      uncertain: false,
    });
    expect(d.lines.find((l) => l.key === "pommedeterre")).toMatchObject({ qty: null, uncertain: true });
  });

  it("déduit les mois de saison des recettes du catalogue", () => {
    const months = vegMonths(LIB);
    expect(Object.keys(months).length).toBeGreaterThan(0);
    for (const [key, list] of Object.entries(months)) {
      expect(LIB.ingredients[key]?.c).toBe("legumes");
      expect(list.every((m) => m >= 1 && m <= 12)).toBe(true);
    }
  });

  it("demande les portions quand la page ne les donne pas", () => {
    const { recipe } = extractRecipe(fixture("marmiton"))!;
    const d = buildDraft({
      recipe: { ...recipe, yield: null },
      url: "https://x.fr",
      sourceName: "x",
      lib: LIB,
    });
    expect(d.servings).toBeNull();
    const forced = buildDraft({
      recipe: { ...recipe, yield: null },
      url: "https://x.fr",
      sourceName: "x",
      lib: LIB,
      servings: 8,
    });
    expect(forced.lines[0]?.qty).toBe(600);
  });
});

describe("recette validée → catalogue", () => {
  const base = () => {
    const { recipe } = extractRecipe(fixture("marmiton"))!;
    const d = buildDraft({ recipe, url: "https://www.marmiton.org/x", sourceName: "Marmiton", lib: LIB });
    return {
      ...draftToForm(d),
      steps: ["Fais dorer le poulet.", "Ajoute les légumes et laisse mijoter 45 min."],
    };
  };
  const keysOf = (form: ReturnType<typeof base>) =>
    form.lines.map((l) => (l.key && LIB.ingredients[l.key] ? l.key : null));

  it("produit un plat de batch conforme au format du catalogue, sans étape d'origine", () => {
    const form = base();
    const out = toRecipe(importFormSchema.parse(form), keysOf(form));
    expect(out.kind).toBe("main");
    const parsed = mainSchema.safeParse({ id: "imp_test", ...out.data });
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(out.kind === "main" && out.data.blocks[0]?.a).toEqual(form.steps);
    expect(JSON.stringify(out)).not.toContain("Texte de démonstration");
  });

  it("chaque type respecte son schéma, macros inconnues signalées", () => {
    const form = { ...base(), kcal: null, proteinG: null };
    const keys = keysOf(form);
    expect(
      simpleSchema.safeParse({ id: "x", ...toRecipe({ ...form, kind: "simple" }, keys).data }).success,
    ).toBe(true);
    expect(soupSchema.safeParse({ id: "x", ...toRecipe({ ...form, kind: "soup" }, keys).data }).success).toBe(
      true,
    );
    const cake = toRecipe({ ...form, kind: "cake" }, keys);
    expect(cakeSchema.safeParse({ id: "x", ...cake.data }).success).toBe(true);
    expect(cake.data.mu).toBe(true);
  });

  it("aller-retour avec l'écran de modification", () => {
    const form = base();
    const out = toRecipe(form, keysOf(form));
    const back = fromRecipe(
      out.kind,
      out.data as Record<string, unknown>,
      { url: form.sourceUrl, name: form.sourceName },
      LIB.ingredients,
    );
    expect(back).toMatchObject({
      name: form.name,
      kind: "main",
      protein: "volaille",
      steps: form.steps,
      kcal: 420,
    });
    expect(
      toRecipe(
        back,
        back.lines.map((l) => l.key),
      ),
    ).toEqual(out);
  });

  it("une recette importée et validée est proposée par le générateur (20 générations)", () => {
    const form = base();
    const out = toRecipe(form, keysOf(form));
    const imported = { id: "imp_poulet", ...out.data } as Main;
    const lib = { ...LIB, mains: [...LIB.mains, imported] };
    let seen = 0;
    for (let i = 0; i < 20; i++) {
      const env = createEnv({ lib, random: seededRandom(100 + i), bonus: { imp_poulet: 0.3 } });
      const res = generateWeek({
        env,
        settings: DEFAULT_MENU_SETTINGS,
        start: "2027-08-02",
        previous: null,
        history: [],
        bank: [],
      });
      expect(res.ok).toBe(true);
      if (res.ok && res.week.groups.some((g) => g.id === "imp_poulet")) seen++;
    }
    expect(seen).toBeGreaterThanOrEqual(1);
  });

  it("une recette supprimée n'est plus tirée mais reste lisible", () => {
    const form = base();
    const imported = { id: "imp_poulet", ...toRecipe(form, keysOf(form)).data } as Main;
    const env = createEnv({
      lib: { ...LIB, mains: [...LIB.mains, imported], retired: ["imp_poulet"] },
      random: seededRandom(1),
    });
    expect(env.lib.mains.some((r) => r.id === "imp_poulet")).toBe(false);
    expect(env.mainById.get("imp_poulet")?.n).toBe("Poulet basquaise facile");
  });
});
