import { describe, expect, it } from "vitest";
import {
  engineBank,
  engineEnv,
  engineHistory,
  engineSettings,
  LEGACY_GENERATE,
  weekShape,
} from "../../tests/legacy/fixtures";
import { type LegacyState, loadLegacy } from "../../tests/legacy/legacy";
import { generateWeek, weekRecipeIds } from "./compose";
import { moveSlot, suggestWeekend, swap } from "./edit";
import { legacyPortions } from "./portions";
import { totals } from "./quantities";
import { buildSession } from "./session";
import { DEFAULT_EQUIPMENT, type WeekPlan } from "./types";

/**
 * Fidélité au prototype (§7, CLAUDE.md) : à graine et état égaux, le moteur porté produit exactement
 * la même semaine, les mêmes quantités et la même session que reference/menu-legacy.html.
 */

const legacy = loadLegacy();
const pm = legacyPortions(0.5);

const base: LegacyState["settings"] = { light: 2, pasta: 2, comfort: 1, world: 2, bankUse: 2, skip: [] };

const CASES: { name: string; state: LegacyState }[] = [
  { name: "réglages du prototype, mars", state: { settings: base, week: { start: "2027-03-01" } } },
  { name: "été, 4 soirs légers", state: { settings: { ...base, light: 4 }, week: { start: "2027-07-05" } } },
  {
    name: "aucun soir léger, 1 plat de pâtes",
    state: { settings: { ...base, light: 0, pasta: 1 }, week: { start: "2027-10-04" } },
  },
  {
    name: "3 soirs légers, réconfort 2, monde 3",
    state: { settings: { ...base, light: 3, comfort: 2, world: 3 }, week: { start: "2027-01-04" } },
  },
  {
    name: "créneaux décochés",
    state: { settings: { ...base, skip: ["1-lunch", "3-dinner", "5-lunch"] }, week: { start: "2027-05-03" } },
  },
  {
    name: "réserve du congélateur",
    state: {
      settings: { ...base, bankUse: 3 },
      week: { start: "2027-11-01" },
      bank: { chili: { boxes: 2, added: 1 }, bolo_lentilles: { boxes: 1, added: 2 } },
    },
  },
  {
    name: "garde-manger, favoris et refus",
    state: {
      settings: { ...base, comfort: 0 },
      week: { start: "2027-09-06" },
      pantry: { courgette: 2, poivron: null, epinards: 300, lardons: 150 },
      ratings: { chili: 1, curry_pois_chiches: 1, gratin_thon: -1, dahl: -1 },
    },
  },
  {
    name: "historique (anti-répétition)",
    state: {
      settings: base,
      week: { start: "2027-02-01" },
      history: [
        ["chili", "dahl", "gratin_thon", "veloute_poireau"],
        ["navarin", "tourte_poulet"],
      ],
    },
  },
  {
    name: "réconfort 1 toutes les 2 semaines",
    state: { settings: { ...base, comfort: 0.5 }, week: { start: "2027-04-05" } },
  },
];

const SEEDS = [1, 7, 42, 2024];

function engineGenerate(state: LegacyState, seed: number) {
  const env = engineEnv(state, seed);
  const res = generateWeek({
    env,
    settings: engineSettings(state),
    start: state.week.start as string,
    previous: null,
    bank: engineBank(state),
    history: engineHistory(state, []),
  });
  return { env, week: res.ok ? res.week : null };
}

describe("génération identique au prototype", () => {
  for (const { name, state } of CASES) {
    it.each(SEEDS)(`${name} (graine %i)`, (seed) => {
      const expected = legacy.run<Record<string, unknown>>(state, seed, LEGACY_GENERATE);
      const { week } = engineGenerate(state, seed);
      expect(week).not.toBeNull();
      expect(weekShape(week as unknown as Record<string, unknown>)).toEqual(weekShape(expected));
    });
  }
});

describe("quantités et session identiques au prototype", () => {
  for (const { name, state } of CASES) {
    it.each(SEEDS)(`${name} (graine %i)`, (seed) => {
      const { env, week } = engineGenerate(state, seed);
      if (!week) throw new Error("semaine non générée");
      const expected = legacy.run<{
        totals: Record<string, number>;
        total: number;
        steps: Record<string, unknown>[];
      }>(
        { ...state, week: week as unknown as Record<string, unknown> },
        seed,
        `(() => { buildSession(); return { totals: totals(), total: SESSION.total, steps: STEPS }; })()`,
      );
      const t = totals(env, week, pm, state.settings.gateau ?? true);
      expect(t).toEqual(expected.totals);
      const session = buildSession({
        env,
        week,
        pm,
        pantry: env.pantry,
        totals: t,
        equipment: DEFAULT_EQUIPMENT,
      });
      expect(session.total).toBe(expected.total);
      expect(
        session.steps.map((s) => ({
          start: s.start,
          n: s.name,
          w: s.where,
          a: s.tasks,
          timer: s.timer?.minutes ?? 0,
        })),
      ).toEqual(expected.steps.map((s) => ({ start: s.start, n: s.n, w: s.w, a: s.a, timer: s.timer ?? 0 })));
    });
  }
});

describe("modifications identiques au prototype", () => {
  const state = CASES[0]!.state;
  const settings = engineSettings(state);

  it.each(SEEDS)("Changer chaque plat, la soupe et chaque soir simple (graine %i)", (seed) => {
    const { week } = engineGenerate({ ...state, settings: { ...base, light: 4 } }, seed);
    const w = week!;
    const ops: [string, number][] = [
      ...w.groups.map((_, i) => ["main", i] as [string, number]),
      ["soup", 0],
      ...w.simples.map((_, i) => ["simple", i] as [string, number]),
    ];
    let changed = 0;
    for (const [kind, idx] of ops) {
      const expected = legacy.run<Record<string, unknown>>(
        { ...state, settings: { ...base, light: 4 }, week: w as unknown as Record<string, unknown> },
        seed + idx,
        `(() => { afterChange = () => {}; flash = () => {}; swap(${JSON.stringify(kind)}, ${idx}); return week; })()`,
      );
      const env = engineEnv(state, seed + idx);
      const res = swap(env, w, { ...settings, light: 4 }, kind as "main", idx);
      if (res.ok && res.added.length) changed++;
      expect(
        res.ok
          ? weekShape(res.week as unknown as Record<string, unknown>)
          : weekShape(w as unknown as Record<string, unknown>),
      ).toEqual(weekShape(expected));
    }
    expect(changed).toBe(ops.length);
  });

  it.each(SEEDS)("Déplacer et suggérer le week-end (graine %i)", (seed) => {
    const { week } = engineGenerate(state, seed);
    const w = week!;
    const moves: [string, string][] = [
      ["1-dinner", "3-dinner"],
      ["2-lunch", "4-dinner"],
      ["5-lunch", "1-lunch"],
    ];
    for (const [a, b] of moves) {
      const expected = legacy.run<{ week: Record<string, unknown>; clash: boolean }>(
        { ...state, week: w as unknown as Record<string, unknown> },
        seed,
        `(() => { afterChange = () => {}; flash = () => {}; const before = JSON.parse(JSON.stringify(week)); moveSlot(${JSON.stringify(a)}, ${JSON.stringify(b)}); return { week, clash: addsPastaClash(before, week) }; })()`,
      );
      const res = moveSlot(engineEnv(state, seed), w, a, b);
      if (!res.ok && res.reason === "pasta_clash") {
        // Écart voulu (§7.6) : le prototype acceptait ce déplacement, qui crée deux repas de pâtes le même jour.
        expect(expected.clash).toBe(true);
        continue;
      }
      expect(
        res.ok
          ? weekShape(res.week as unknown as Record<string, unknown>)
          : weekShape(w as unknown as Record<string, unknown>),
      ).toEqual(weekShape(expected.week));
    }
    const expectedWk = legacy.run<Record<string, string>>(
      { ...state, week: w as unknown as Record<string, unknown> },
      seed,
      `(() => { afterChange = () => {}; suggestWeekend(); return week.weekend; })()`,
    );
    expect(Object.keys(expectedWk)).toHaveLength(4);
    expect(suggestWeekend(engineEnv(state, seed), w).week.weekend).toEqual(expectedWk);
  });

  it("garde l'historique au format attendu", () => {
    const { week } = engineGenerate(state, 1);
    expect(weekRecipeIds(week as WeekPlan).length).toBeGreaterThan(0);
  });
});
