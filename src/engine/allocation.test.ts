import { describe, expect, it } from "vitest";
import { allocate, stockPerWeek } from "./allocation";

const occ = (uid: string, order: number, needs: Record<string, number>) => ({ uid, order, needs });

describe("allocation", () => {
  it("ingrédient partagé : le stock n'est alloué qu'une fois (AC-04)", () => {
    const r = allocate({
      occurrences: [occ("a", 1, { x: 300 }), occ("b", 2, { x: 200 })],
      stock: { x: 300 },
      purchases: {},
    });
    expect(r.byOccurrence.a!.x).toEqual({ stock: 300, purchase: 0, deficit: 0 });
    expect(r.byOccurrence.b!.x).toEqual({ stock: 0, purchase: 0, deficit: 200 });
    // La substitution de la deuxième préparation retire son besoin : 300 g alloués, une seule fois.
    const after = allocate({
      occurrences: [occ("a", 1, { x: 300 }), occ("b", 2, {})],
      stock: { x: 300 },
      purchases: {},
    });
    expect(after.byIngredient.x).toMatchObject({ need: 300, stock: 300, deficit: 0 });
  });

  it("alloue le stock avant les achats, et départage par rang puis identifiant", () => {
    const r = allocate({
      occurrences: [occ("b", 1, { x: 100 }), occ("a", 1, { x: 100 })],
      stock: { x: 100 },
      purchases: { x: 100 },
    });
    expect(r.byOccurrence.a!.x).toEqual({ stock: 100, purchase: 0, deficit: 0 });
    expect(r.byOccurrence.b!.x).toEqual({ stock: 0, purchase: 100, deficit: 0 });
  });

  it("un achat dont le besoin disparaît devient surplus et reste enregistré (AC-07)", () => {
    const withNeed = allocate({ occurrences: [occ("a", 1, { x: 100 })], stock: {}, purchases: { x: 400 } });
    expect(withNeed.byIngredient.x).toMatchObject({ purchase: 100, surplus: 300 });
  });

  it("correction sous une allocation figée : écart isolé, jamais de quantité négative (AC-20)", () => {
    const r = allocate({
      occurrences: [occ("started", 1, { x: 600 }), occ("later", 2, { x: 100 })],
      locked: new Set(["started"]),
      frozen: { started: { x: 600 } },
      stock: {},
      purchases: { x: 400 },
    });
    expect(r.byOccurrence.started!.x).toEqual({ stock: 0, purchase: 400, deficit: 200 });
    expect(r.byIngredient.x!.discrepancy).toBe(200);
    expect(r.byOccurrence.later!.x).toEqual({ stock: 0, purchase: 0, deficit: 100 });
    for (const a of Object.values(r.byOccurrence).flatMap((o) => Object.values(o))) {
      expect(a.stock).toBeGreaterThanOrEqual(0);
      expect(a.purchase).toBeGreaterThanOrEqual(0);
    }
  });

  it("une préparation verrouillée garde sa part même si une autre passe avant", () => {
    const r = allocate({
      occurrences: [occ("free", 1, { x: 300 }), occ("locked", 9, { x: 300 })],
      locked: new Set(["locked"]),
      stock: { x: 300 },
      purchases: {},
    });
    expect(r.byOccurrence.locked!.x!.stock).toBe(300);
    expect(r.byOccurrence.free!.x!.deficit).toBe(300);
  });

  it("propriété : jamais plus alloué que disponible", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 200; n++) {
      const occs = Array.from({ length: 1 + Math.floor(rnd() * 5) }, (_, i) =>
        occ(`o${i}`, Math.floor(rnd() * 3), { x: Math.floor(rnd() * 500) + 1 }),
      );
      const stock = Math.floor(rnd() * 600);
      const purchase = Math.floor(rnd() * 600);
      const r = allocate({ occurrences: occs, stock: { x: stock }, purchases: { x: purchase } });
      const t = r.byIngredient.x!;
      expect(t.stock).toBeLessThanOrEqual(stock);
      expect(t.purchase).toBeLessThanOrEqual(purchase);
      expect(t.stock + t.purchase + t.deficit).toBeCloseTo(t.need, 6);
    }
  });
});

describe("stock partagé entre semaines", () => {
  it("500 g de stock, 400 g réservés : la semaine suivante n'a que 100 g (AC-11)", () => {
    const weeks = stockPerWeek({ x: 500 }, [{ x: 400 }, { x: 300 }]);
    expect(weeks[0]!.available.x).toBe(500);
    expect(weeks[1]!.available.x).toBe(100);
    const next = allocate({ occurrences: [occ("n", 1, { x: 300 })], stock: weeks[1]!.available, purchases: {} });
    expect(next.byIngredient.x).toMatchObject({ stock: 100, deficit: 200 });
  });

  it("un stock « assez » ne couvre pas deux semaines (AC-25)", () => {
    const weeks = stockPerWeek({ x: null }, [{ x: 200 }, { x: 100 }]);
    expect(weeks[0]!.unverified.has("x")).toBe(false);
    expect(weeks[1]!.unverified.has("x")).toBe(true);
  });

  it("avec une quantité mesurée, aucune vérification n'est demandée", () => {
    const weeks = stockPerWeek({ x: 1000 }, [{ x: 200 }, { x: 100 }]);
    expect(weeks[1]!.unverified.size).toBe(0);
    expect(weeks[1]!.available.x).toBe(800);
  });
});
