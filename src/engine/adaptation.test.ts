import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { MAX_PROPOSALS, applyReplacement, propose } from "./adaptation";
import { generateWeek } from "./compose";
import { createEnv } from "./env";
import { ensureOccurrenceIds, listOccurrences, sumNeeds } from "./occurrences";
import { legacyPortions } from "./portions";
import { seededRandom } from "./random";
import { DEFAULT_MENU_SETTINGS, type DietRules, type WeekPlan } from "./types";

const pm = legacyPortions();
let n = 0;
const newId = () => `u${++n}`;

function setup(seed: number, diet?: DietRules) {
  const env = createEnv({ lib: LIB, random: seededRandom(seed), diet });
  const res = generateWeek({
    env,
    settings: DEFAULT_MENU_SETTINGS,
    start: "2027-03-01",
    previous: null,
    history: [],
    bank: [],
  });
  if (!res.ok) throw new Error("génération");
  const week: WeekPlan = ensureOccurrenceIds(res.week, newId);
  const occs = listOccurrences(env, week, pm, true);
  return { env, week, occs };
}

/** Un ingrédient (hors placard) utilisé par une seule préparation de plat, avec son besoin. */
function pickMissing(env: ReturnType<typeof setup>["env"], occs: ReturnType<typeof setup>["occs"]) {
  const total = sumNeeds(occs);
  for (const o of occs.filter((x) => x.kind === "main")) {
    for (const [k, q] of Object.entries(o.needs)) {
      if (LIB.ingredients[k]!.c === "base") continue;
      const users = occs.filter((x) => x.needs[k] !== undefined);
      if (users.length === 1 && total[k]! >= q) return { uid: o.uid, key: k, need: q };
    }
  }
  throw new Error("aucun ingrédient");
}

describe("adaptation : propositions", () => {
  it("chaque proposition résout le manque sans toucher aux autres préparations", () => {
    const { env, week, occs } = setup(2);
    const m = pickMissing(env, occs);
    const r = propose({
      env,
      week,
      pm,
      cakeOn: true,
      locked: new Set(),
      selected: [{ ingredient: m.key, decision: "search_elsewhere" }],
      // Tout est acheté sauf cet ingrédient : le manque est celui qu'on a sélectionné.
      stock: {},
      purchases: Object.fromEntries(Object.entries(sumNeeds(occs)).filter(([k]) => k !== m.key)),
    });
    expect(r.proposals.length).toBeLessThanOrEqual(MAX_PROPOSALS);
    for (const p of r.proposals) {
      expect(p.resolved).toContain(m.key);
      expect(p.replacements.every((x) => x.uid === m.uid || r.affected.includes(x.uid))).toBe(true);
      for (const rep of p.replacements) {
        const others = p.weekAfter.groups.filter((g) => g.uid !== rep.uid);
        const before = week.groups.filter((g) => g.uid !== rep.uid);
        if (p.replacements.length === 1) expect(others.map((g) => g.id)).toEqual(before.map((g) => g.id));
      }
    }
  });

  it("est déterministe et ne modifie pas le plan fourni", () => {
    const { env, week, occs } = setup(3);
    const m = pickMissing(env, occs);
    const snapshot = JSON.stringify(week);
    const args = {
      env,
      week,
      pm,
      cakeOn: true,
      locked: new Set<string>(),
      selected: [{ ingredient: m.key, decision: "open" as const }],
      stock: {},
      purchases: {},
    };
    const a = propose(args);
    const b = propose(args);
    expect(a.proposals.map((p) => p.replacements)).toEqual(b.proposals.map((p) => p.replacements));
    expect(JSON.stringify(week)).toBe(snapshot);
  });

  it("une préparation verrouillée n'est jamais proposée au remplacement (AC-10)", () => {
    const { env, week, occs } = setup(2);
    const m = pickMissing(env, occs);
    const r = propose({
      env,
      week,
      pm,
      cakeOn: true,
      locked: new Set(occs.map((o) => o.uid)),
      selected: [{ ingredient: m.key, decision: "open" }],
      stock: {},
      purchases: {},
    });
    expect(r.proposals).toEqual([]);
    expect(r.excluded.some((e) => e.uid === m.uid && e.reason === "locked")).toBe(true);
  });

  it("« ne plus acheter » : aucune proposition n'ajoute un complément de cet ingrédient (AC-24)", () => {
    const { env, week, occs } = setup(4);
    const m = pickMissing(env, occs);
    const r = propose({
      env,
      week,
      pm,
      cakeOn: true,
      locked: new Set(),
      selected: [{ ingredient: m.key, decision: "no_more" }],
      stock: {},
      purchases: {},
    });
    for (const p of r.proposals) expect(p.deficitsAfter[m.key] ?? 0).toBe(0);
  });

  it("une recette refusée par le foyer n'est jamais proposée (AC-06)", () => {
    const base = setup(5);
    const m = pickMissing(base.env, base.occs);
    const refused = Object.keys(LIB.ingredients).find(
      (k) =>
        LIB.ingredients[k]!.c !== "base" && k !== m.key && base.occs.every((o) => o.needs[k] === undefined),
    )!;
    const { env, week } = setup(5, { diet: "omnivore", allergens: [], refused: [refused] });
    const r = propose({
      env,
      week,
      pm,
      cakeOn: true,
      locked: new Set(),
      selected: [{ ingredient: m.key, decision: "search_elsewhere" }],
      stock: {},
      purchases: {},
    });
    for (const p of r.proposals)
      for (const rep of p.replacements) {
        const rec =
          env.mainById.get(rep.recipeId) ??
          env.soupById.get(rep.recipeId) ??
          env.simpleById.get(rep.recipeId)!;
        expect(Object.keys(rec.ing)).not.toContain(refused);
      }
  });

  it("le budget interrompt la recherche et le dit (§12)", () => {
    const { env, week, occs } = setup(2);
    const m = pickMissing(env, occs);
    const r = propose({
      env,
      week,
      pm,
      cakeOn: true,
      locked: new Set(),
      selected: [{ ingredient: m.key, decision: "open" }],
      stock: {},
      purchases: {},
      budget: 1,
    });
    expect(r.evaluated).toBeLessThanOrEqual(1);
    expect(r.limited).toBe(true);
  });

  it("applyReplacement garde l'identité de la préparation", () => {
    const { week } = setup(2);
    const g = week.groups[0]!;
    const next = applyReplacement(week, { uid: g.uid!, recipeId: "autre" })!;
    expect(next.groups[0]).toMatchObject({ uid: g.uid, id: "autre" });
    expect(week.groups[0]!.id).toBe(g.id);
    expect(applyReplacement(week, { uid: "inconnue", recipeId: "x" })).toBeNull();
  });
});

describe("budget de performance (§19)", () => {
  it("un aperçu complet (200 évaluations) reste sous 2 secondes", () => {
    const { env, week, occs } = setup(2);
    const total = sumNeeds(occs);
    const selected = Object.keys(total)
      .filter((k) => LIB.ingredients[k]!.c !== "base")
      .slice(0, 20)
      .map((ingredient) => ({ ingredient, decision: "search_elsewhere" as const }));
    const t0 = performance.now();
    const r = propose({ env, week, pm, cakeOn: true, locked: new Set(), selected, stock: {}, purchases: {} });
    const ms = performance.now() - t0;
    expect(r.evaluated).toBeLessThanOrEqual(200);
    expect(ms).toBeLessThan(2000);
  });
});
