import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { generateWeek, pastaCount } from "./compose";
import { createEnv } from "./env";
import { seededRandom } from "./random";
import { gMax } from "./slots";
import { DEFAULT_MENU_SETTINGS, type WeekPlan } from "./types";

/**
 * §7.6 : génération sur toutes les combinaisons des réglages (12 mois × pâtes 1-2 × soirs légers 0-4 ×
 * réserve 0-4 × 4 jeux de créneaux décochés) : aucun échec avec le repli, zéro jour avec 2 repas de pâtes,
 * plafonds respectés.
 */

const SKIPS = [
  [],
  ["1-lunch", "2-lunch"],
  ["3-dinner", "4-lunch", "5-dinner"],
  ["1-dinner", "2-dinner", "5-lunch", "5-dinner"],
];
const BANK = [
  { recipeId: "chili", portions: 2, frozenAt: "2026-01-01" },
  { recipeId: "dahl", portions: 2, frozenAt: "2026-01-02" },
  { recipeId: "veloute_poireau", portions: 2, frozenAt: "2026-01-03" },
];

type Case = { month: number; pasta: number; light: number; bankUse: number; skip: string[] };
const CASES: Case[] = [];
for (let month = 1; month <= 12; month++)
  for (const pasta of [1, 2])
    for (let light = 0; light <= 4; light++)
      for (let bankUse = 0; bankUse <= 4; bankUse++)
        for (const skip of SKIPS) CASES.push({ month, pasta, light, bankUse, skip });

function violations(c: Case, w: WeekPlan): string[] {
  const out: string[] = [];
  const mains = w.groups.map((g) => LIB.mains.find((r) => r.id === g.id)!);
  const caps = DEFAULT_MENU_SETTINGS.proteinCaps;
  for (const p of Object.keys(caps) as (keyof typeof caps)[]) {
    if (mains.filter((r) => r.p === p).length > caps[p]) out.push(`plafond ${p}`);
  }
  if (mains.filter((r) => r.oven).length > DEFAULT_MENU_SETTINGS.ovenMax) out.push("four");
  const grps = mains.map((r) => r.grp).filter(Boolean);
  if (new Set(grps).size !== grps.length) out.push("famille en double");
  if (mains.length >= 4 && !mains.some((r) => r.p === "veg")) out.push("aucun végétarien");
  if (mains.filter((r) => r.comfort).length !== w.cm) out.push("réconfort");
  if (Object.values(pastaCount(createEnv({ lib: LIB, random: Math.random }), w)).some((n) => n > 1))
    out.push("2 repas de pâtes un même jour");
  w.groups.forEach((g, i) => {
    if (!mains[i]!.freeze && gMax(g.meals) > mains[i]!.fridge) out.push(`conservation ${g.id}`);
  });
  const all = [
    ...w.groups.flatMap((g) => g.meals),
    ...w.bank,
    ...w.simples.map((s) => ({ day: s.day, meal: "dinner" })),
    ...(w.soup?.days ?? []).map((d) => ({ day: d, meal: "dinner" })),
  ];
  for (const k of c.skip)
    if (all.some((m) => `${m.day}-${m.meal}` === k)) out.push(`créneau décoché ${k} utilisé`);
  if (w.soup && w.soup.days.length !== 2) out.push("soupe");
  if (w.bank.some((b) => !BANK.some((e) => e.recipeId === b.id))) out.push("réserve");
  return out;
}

describe("grille des réglages (§7.6)", () => {
  it(`${CASES.length} combinaisons : aucun échec, aucune règle enfreinte`, () => {
    const problems: string[] = [];
    CASES.forEach((c, n) => {
      const env = createEnv({ lib: LIB, random: seededRandom(n) });
      const res = generateWeek({
        env,
        settings: {
          ...DEFAULT_MENU_SETTINGS,
          pasta: c.pasta,
          light: c.light,
          bankUse: c.bankUse,
          skip: c.skip,
        },
        start: `2027-${String(c.month).padStart(2, "0")}-01`,
        previous: null,
        history: [],
        bank: BANK,
      });
      const label = `mois ${c.month}, pâtes ${c.pasta}, légers ${c.light}, réserve ${c.bankUse}, décochés ${c.skip.join(",") || "aucun"}`;
      if (!res.ok) problems.push(`${label} : échec`);
      else for (const v of violations(c, res.week)) problems.push(`${label} : ${v}`);
    });
    expect(CASES).toHaveLength(2400);
    expect(problems).toEqual([]);
  }, 30_000);
});
