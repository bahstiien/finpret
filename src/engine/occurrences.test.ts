import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { generateWeek } from "./compose";
import { swap } from "./edit";
import { createEnv } from "./env";
import {
  changedOccurrences,
  ensureOccurrenceIds,
  isProtected,
  listOccurrences,
  lockedUids,
  sumNeeds,
} from "./occurrences";
import { legacyPortions } from "./portions";
import { totals } from "./quantities";
import { seededRandom } from "./random";
import { DEFAULT_MENU_SETTINGS, type WeekPlan } from "./types";

const pm = legacyPortions();
const weekFor = (seed: number): { week: WeekPlan; env: ReturnType<typeof createEnv> } => {
  const env = createEnv({ lib: LIB, random: seededRandom(seed) });
  const res = generateWeek({
    env,
    settings: DEFAULT_MENU_SETTINGS,
    start: "2027-03-01",
    previous: null,
    history: [],
    bank: [],
  });
  if (!res.ok) throw new Error("génération");
  return { week: res.week, env };
};
let n = 0;
const newId = () => `u${++n}`;

describe("occurrences", () => {
  it("la somme des besoins par occurrence égale les totaux de la semaine", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { week, env } = weekFor(seed);
      const sum = sumNeeds(listOccurrences(env, week, pm, true));
      const t = totals(env, week, pm, true);
      expect(Object.keys(sum).sort()).toEqual(Object.keys(t).sort());
      for (const k in t) expect(sum[k]).toBeCloseTo(t[k]!, 6);
    }
  });

  it("une cuisson servie à plusieurs repas est une seule occurrence (AC-05)", () => {
    const { week, env } = weekFor(2);
    const occ = listOccurrences(env, week, pm, true).filter((o) => o.kind === "main");
    expect(occ.length).toBe(week.groups.length);
    expect(occ.some((o) => o.slots.length > 1)).toBe(true);
  });

  it("les identités sont attribuées une fois et conservées par un remplacement", () => {
    const { week, env } = weekFor(3);
    const withIds = ensureOccurrenceIds(week, newId);
    expect(ensureOccurrenceIds(withIds, newId)).toEqual(withIds);
    const swapped = swap(env, withIds, DEFAULT_MENU_SETTINGS, "main", 0);
    expect(swapped.ok).toBe(true);
    if (swapped.ok) expect(swapped.week.groups.map((g) => g.uid)).toEqual(withIds.groups.map((g) => g.uid));
  });

  it("seule l'occurrence remplacée est signalée comme modifiée", () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((x) => weekFor(x).week.soup !== null)!;
    const { week, env } = weekFor(seed);
    const base = ensureOccurrenceIds(week, newId);
    const before = listOccurrences(env, base, pm, true);
    const swapped = swap(env, base, DEFAULT_MENU_SETTINGS, "soup", 0);
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    const after = listOccurrences(env, swapped.week, pm, true);
    expect(changedOccurrences(before, after)).toEqual([base.soup!.uid]);
  });

  it("deux occurrences de la même recette restent distinctes (AC-22)", () => {
    const { week, env } = weekFor(5);
    const base = ensureOccurrenceIds(week, newId);
    const twin = structuredClone(base);
    twin.groups[1]!.id = twin.groups[0]!.id;
    const occ = listOccurrences(env, twin, pm, true).filter((o) => o.kind === "main");
    expect(new Set(occ.map((o) => o.uid)).size).toBe(occ.length);
    const modified = structuredClone(twin);
    const m = twin.groups[0]!.meals[0]!;
    modified.removed = [...modified.removed, `${m.day}-${m.meal}`];
    const changed = changedOccurrences(listOccurrences(env, twin, pm, true), listOccurrences(env, modified, pm, true));
    expect(changed).toContain(twin.groups[0]!.uid);
    expect(changed).not.toContain(twin.groups[1]!.uid);
  });
});

describe("verrouillage", () => {
  const { week, env } = weekFor(6);
  const occ = listOccurrences(env, ensureOccurrenceIds(week, newId), pm, true);
  it("démarrer la session verrouille toutes les préparations (§14)", () => {
    expect(lockedUids(occ, {}, true).size).toBe(occ.length);
    expect(lockedUids(occ, {}, false).size).toBe(0);
  });
  it("une préparation marquée commencée ou préparée est protégée, pas une annulée", () => {
    const a = occ[0]!.uid;
    expect([...lockedUids(occ, { [a]: "started" }, false)]).toEqual([a]);
    expect([...lockedUids(occ, { [a]: "prepared" }, false)]).toEqual([a]);
    expect(lockedUids(occ, { [a]: "cancelled" }, false).size).toBe(0);
    expect(isProtected("planned")).toBe(false);
  });
});
