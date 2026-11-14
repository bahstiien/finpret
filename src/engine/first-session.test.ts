import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import { generateWeek } from "./compose";
import { createEnv } from "./env";
import { effectiveLevel, endTime, packaging, prepTile } from "./first-session";
import { legacyPortions } from "./portions";
import { totals } from "./quantities";
import { seededRandom } from "./random";
import { buildSession } from "./session";
import { DEFAULT_EQUIPMENT, DEFAULT_MENU_SETTINGS } from "./types";

function week(seed: number) {
  const env = createEnv({ lib: LIB, random: seededRandom(seed) });
  const res = generateWeek({
    env,
    settings: DEFAULT_MENU_SETTINGS,
    start: "2027-03-01",
    previous: null,
    history: [],
    bank: [],
  });
  if (!res.ok) throw new Error("génération impossible");
  return { env, plan: res.week };
}

describe("boîtes de la session (packaging)", () => {
  it.each([1, 2, 3, 4, 5])("cohérent avec l'étape « Portionnage » de buildSession (graine %i)", (seed) => {
    const { env, plan } = week(seed);
    const pm = legacyPortions();
    const pack = packaging(env, plan, pm);
    const session = buildSession({
      env,
      week: plan,
      pm,
      pantry: {},
      totals: totals(env, plan, pm, true),
      equipment: DEFAULT_EQUIPMENT,
    });
    const portioning = session.steps.find((s) => s.name === "Portionnage")!;
    const inSession = portioning.tasks.join(" ").match(/1 boîte de/g)?.length ?? 0;
    expect(pack.boxes.length).toBe(inSession);
    expect(pack.fridge + pack.freezer).toBe(pack.boxes.length);
    expect(pack.boxes.length).toBeGreaterThan(0);
  });

  it("aucune boîte sans portions, aucun texte undefined ni NaN", () => {
    const { env, plan } = week(7);
    for (const b of packaging(env, plan, legacyPortions()).boxes) {
      expect(`${b.recipe} ${b.portions} ${b.label}`).not.toMatch(/undefined|NaN/);
      expect(Number(b.portions.replace(",", "."))).toBeGreaterThan(0);
    }
  });

  it("un repas retiré n'a plus de boîte", () => {
    const { env, plan } = week(2);
    const before = packaging(env, plan, legacyPortions()).boxes.length;
    const first = plan.groups[0]!.meals[0]!;
    const removed = { ...plan, removed: [...plan.removed, `${first.day}-${first.meal}`] };
    expect(packaging(env, removed, legacyPortions()).boxes.length).toBe(before - 1);
  });
});

describe("Tile de la veille", () => {
  // 2027-01-02 est un samedi, 2027-01-03 un dimanche.
  const base = { sessionDay: 0, hasWeek: true, started: false, done: false };
  it("affichée la veille du jour de session", () => {
    expect(prepTile({ ...base, today: "2027-01-02" })).toBe("eve");
  });
  it("affichée le jour même tant que la session n'est pas lancée", () => {
    expect(prepTile({ ...base, today: "2027-01-03" })).toBe("today");
    expect(prepTile({ ...base, today: "2027-01-03", started: true })).toBeNull();
  });
  it("absente hors veille (session dans 3 jours)", () => {
    expect(prepTile({ ...base, today: "2026-12-31" })).toBeNull();
  });
  it("absente sans semaine ou après une session terminée", () => {
    expect(prepTile({ ...base, today: "2027-01-02", hasWeek: false })).toBeNull();
    expect(prepTile({ ...base, today: "2027-01-02", done: true })).toBeNull();
  });
  it("suit le jour réglé (samedi = 6, lundi = 1)", () => {
    expect(prepTile({ ...base, sessionDay: 6, today: "2027-01-01" })).toBe("eve");
    expect(prepTile({ ...base, sessionDay: 1, today: "2027-01-03" })).toBe("eve");
  });
  it("se reporte à la prochaine date prévue si la session a été sautée", () => {
    expect(prepTile({ ...base, today: "2027-01-09" })).toBe("eve");
  });
});

describe("niveau effectif", () => {
  it("débutant par défaut à la première session, même si le réglage est « à l'aise »", () => {
    expect(effectiveLevel({ firstSession: true, override: null, setting: "confident" })).toBe("beginner");
  });
  it("le choix fait pour la première session est respecté", () => {
    expect(effectiveLevel({ firstSession: true, override: "confident", setting: "beginner" })).toBe("confident");
  });
  it("après la première session, le réglage du foyer s'applique", () => {
    expect(effectiveLevel({ firstSession: false, override: "beginner", setting: "confident" })).toBe("confident");
  });
  it("débutant = session plus longue (+20 %)", () => {
    const { env, plan } = week(6);
    const pm = legacyPortions();
    const t = totals(env, plan, pm, true);
    const run = (level: "beginner" | "confident") =>
      buildSession({ env, week: plan, pm, pantry: {}, totals: t, equipment: DEFAULT_EQUIPMENT, level }).total;
    expect(run("beginner")).toBeGreaterThan(run("confident"));
  });
});

describe("heure de fin", () => {
  it("ajoute la durée à l'heure de début", () => {
    expect(endTime("14:00", 195)).toBe("17:15");
  });
  it("repart de minuit", () => {
    expect(endTime("22:30", 120)).toBe("00:30");
  });
});
