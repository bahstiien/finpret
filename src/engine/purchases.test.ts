import { describe, expect, it } from "vitest";
import { LIB } from "../../tests/legacy/fixtures";
import {
  appendEvent,
  availableBalance,
  containersTotal,
  coverage,
  grossAcquired,
  recommendPacks,
  removableMenuKeys,
  reviewSummary,
  toCatalogUnit,
  type PurchaseDraft,
  type PurchaseEvent,
} from "./purchases";

const gKey = Object.keys(LIB.ingredients).find((k) => LIB.ingredients[k]!.u === "g" && LIB.packs[k])!;
const mlKey = Object.keys(LIB.ingredients).find((k) => LIB.ingredients[k]!.u === "ml")!;
let n = 0;
const newId = () => `e${++n}`;
const draft = (type: PurchaseEvent["type"], qty: number, opKey: string): PurchaseDraft => ({
  weekId: "w1",
  ingredient: "x",
  qty,
  type,
  opKey,
});
const add = (log: PurchaseEvent[], d: PurchaseDraft) => {
  const r = appendEvent(log, d, { newId });
  if (!r.ok) throw new Error(r.code);
  return r.value.log;
};

describe("unités", () => {
  it("convertit kg en g et refuse masse vs volume", () => {
    expect(toCatalogUnit(LIB, gKey, 1.5, "kg")).toEqual({ ok: true, value: 1500 });
    expect(toCatalogUnit(LIB, gKey, 1, "l")).toEqual({ ok: false, code: "INCOMPATIBLE_UNIT" });
    expect(toCatalogUnit(LIB, mlKey, 2, "l")).toEqual({ ok: true, value: 2000 });
  });
  it("refuse négatif, non fini et hors bornes ; accepte zéro", () => {
    expect(toCatalogUnit(LIB, gKey, -1, "g")).toMatchObject({ code: "INVALID_QUANTITY" });
    expect(toCatalogUnit(LIB, gKey, NaN, "g")).toMatchObject({ code: "INVALID_QUANTITY" });
    expect(toCatalogUnit(LIB, gKey, 100_001, "g")).toMatchObject({ code: "INVALID_QUANTITY" });
    expect(toCatalogUnit(LIB, gKey, 0, "g")).toEqual({ ok: true, value: 0 });
  });
  it("« 1 paquet » sans poids demande une confirmation (AC-14)", () => {
    expect(toCatalogUnit(LIB, gKey, 1, "paquet")).toEqual({ ok: false, code: "UNVERIFIED_QUANTITY" });
  });
  it("somme des contenants : 2 × 350 g = 700 g", () => {
    expect(containersTotal(LIB, gKey, [{ n: 2, size: 350, unit: "g" }])).toEqual({ ok: true, value: 700 });
  });
});

describe("journal d'achats", () => {
  it("« modifier le total » remplace, « ajouter » additionne", () => {
    let log: PurchaseEvent[] = [];
    log = add(log, draft("purchase", 400, "a"));
    log = add(log, draft("correction", 700, "b"));
    expect(grossAcquired(log, "w1", "x")).toBe(700);
    log = add(log, draft("purchase", 100, "c"));
    expect(grossAcquired(log, "w1", "x")).toBe(800);
  });
  it("la même clé renvoie le résultat initial sans doubler (AC-09)", () => {
    const log = add([], draft("purchase", 400, "a"));
    const again = appendEvent(log, draft("purchase", 400, "a"), { newId });
    expect(again.ok && again.value.replayed).toBe(true);
    expect(again.ok && grossAcquired(again.value.log, "w1", "x")).toBe(400);
    expect(appendEvent(log, draft("purchase", 999, "a"), { newId })).toEqual({
      ok: false,
      code: "IDEMPOTENCY_CONFLICT",
    });
  });
  it("refuse une écriture sur une révision périmée", () => {
    const log = add([], draft("purchase", 400, "a"));
    expect(appendEvent(log, draft("purchase", 1, "b"), { newId, expectedRevision: 0 })).toEqual({
      ok: false,
      code: "VERSION_CONFLICT",
    });
  });
  it("700 acquis, 200 transférés, correction à 400 : 200 restent (AC-23) ; sous 200, refus", () => {
    let log = add([], draft("purchase", 700, "a"));
    log = add(log, draft("transfer_out", 200, "t"));
    log = add(log, draft("correction", 400, "c"));
    expect(availableBalance(log, "w1", "x")).toBe(200);
    expect(appendEvent(log, draft("correction", 150, "d"), { newId })).toEqual({
      ok: false,
      code: "INSUFFICIENT_AVAILABLE_QUANTITY",
    });
  });
  it("un recalcul de couverture ne change pas le total acquis", () => {
    const log = add([], draft("purchase", 400, "a"));
    const before = grossAcquired(log, "w1", "x");
    coverage({ need: 600, purchased: before });
    coverage({ need: 100, purchased: before });
    expect(grossAcquired(log, "w1", "x")).toBe(before);
  });
});

describe("couverture", () => {
  it("achat partiel (AC-01)", () => {
    expect(coverage({ need: 600, purchased: 400 })).toMatchObject({
      status: "partial",
      deficit: 200,
      surplus: 0,
    });
  });
  it("contenants et surplus (AC-02)", () => {
    expect(coverage({ need: 600, purchased: 700 })).toMatchObject({
      status: "surplus",
      deficit: 0,
      surplus: 100,
    });
  });
  it("stock 100 g + achat 400 g pour 600 g : reste 100 g", () => {
    expect(coverage({ need: 600, stock: 100, purchased: 400 })).toMatchObject({
      deficit: 100,
      stockAllocated: 100,
    });
  });
  it("970 g pour 1 000 g n'est pas couvert (AC-19)", () => {
    expect(coverage({ need: 1000, purchased: 970 })).toMatchObject({ status: "partial", deficit: 30 });
  });
  it("quantité inconnue : à vérifier, jamais zéro (AC-16)", () => {
    expect(coverage({ need: 600, purchased: null })).toMatchObject({ status: "to_verify", deficit: null });
  });
  it("« assez » confirmé pour 200 ne couvre pas 350 (AC-12)", () => {
    expect(coverage({ need: 200, stock: null, purchased: 0, confirmedNeed: 200 }).status).toBe("covered");
    expect(coverage({ need: 350, stock: null, purchased: 0, confirmedNeed: 200 }).status).toBe("to_verify");
    expect(coverage({ need: 200, stock: null, purchased: 0 }).status).toBe("to_verify");
  });
  it("sans achat ni stock : non couvert", () => {
    expect(coverage({ need: 600, purchased: 0 })).toMatchObject({ status: "uncovered", deficit: 600 });
  });
});

describe("recommandation de contenants à 100 %", () => {
  it("couvre toujours le déficit, jamais 97 %", () => {
    const sizes = LIB.packs[gKey]!.s;
    for (const d of [sizes[0]! * 0.98, sizes[0]! * 1.02, sizes[0]! * 3.5]) {
      const r = recommendPacks(LIB, gKey, d)!;
      expect(r.total).toBeGreaterThanOrEqual(d);
      expect(r.short).toBe(0);
    }
  });
  it("renvoie null sans déficit ou sans contenant", () => {
    expect(recommendPacks(LIB, gKey, 0)).toBeNull();
    expect(recommendPacks(LIB, "inconnu", 100)).toBeNull();
  });
});

describe("recalcul de la liste", () => {
  it("ne retire pas une ligne dont l'achat est enregistré (AC-07)", () => {
    expect(removableMenuKeys(["a", "b", "c"], ["a"], new Set(["b"]))).toEqual(["c"]);
    expect(removableMenuKeys(["a"], ["a"], new Set())).toEqual([]);
  });
});

describe("bilan des courses", () => {
  it("compte les manques et les quantités à confirmer, sans annoncer un menu prêt", () => {
    const r = reviewSummary([
      { key: "a", status: "covered" },
      { key: "b", status: "partial", issue: "open" },
      { key: "c", status: "to_verify" },
      { key: "d", status: "surplus" },
    ]);
    expect(r).toMatchObject({
      missing: ["b"],
      toConfirm: ["c"],
      surplus: ["d"],
      unresolved: 2,
      ready: false,
    });
    expect(r.known).toEqual(["a", "d"]);
  });
  it("prêt seulement si rien ne reste à résoudre", () => {
    expect(reviewSummary([{ key: "a", status: "covered" }]).ready).toBe(true);
    expect(reviewSummary([]).ready).toBe(true);
  });
});
