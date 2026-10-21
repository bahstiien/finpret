import type { Totals } from "./quantities";

/**
 * Allocation des ressources (courses réelles, lot L2) : stock connu et achats réels sont répartis entre les
 * préparations. Une allocation est une réservation, pas une consommation. Aucune ressource n'est comptée deux
 * fois ; les allocations d'une préparation verrouillée ne bougent pas.
 */

const dec = (x: number) => Math.round(x * 1e6) / 1e6;

export type AllocInput = {
  uid: string;
  /** Rang de la première date de service : départage les besoins équivalents (§9.3). */
  order: number;
  needs: Totals;
};

export type Allocation = { stock: number; purchase: number; deficit: number };
export type IngredientTotals = {
  need: number;
  stock: number;
  purchase: number;
  deficit: number;
  /** Achats non alloués au plan courant. */
  surplus: number;
  /** Part gelée d'une préparation verrouillée que les ressources actuelles ne couvrent plus (AC-20). */
  discrepancy: number;
};

export type AllocationResult = {
  byOccurrence: Record<string, Record<string, Allocation>>;
  byIngredient: Record<string, IngredientTotals>;
};

/**
 * Répartit les ressources, ingrédient par ingrédient.
 * 1. Les préparations verrouillées conservent leur allocation gelée (`frozen`), prélevée d'abord.
 * 2. Les autres se partagent le reste, stock puis achats, dans l'ordre (rang, identifiant).
 * - `stock` : quantité connue allouable. Absent ou `null` (« assez ») : aucune quantité n'est allouée ici ;
 *   la couverture non quantifiée se décide dans `coverage`.
 * - `reserved` : part déjà réservée ailleurs (autre semaine), retirée du stock.
 */
export function allocate(input: {
  occurrences: readonly AllocInput[];
  locked?: ReadonlySet<string>;
  /** Allocations gelées des préparations verrouillées : `frozen[uid][ingrédient]`. */
  frozen?: Readonly<Record<string, Totals>>;
  stock: Readonly<Record<string, number | null | undefined>>;
  purchases: Readonly<Record<string, number>>;
  reserved?: Readonly<Record<string, number>>;
}): AllocationResult {
  const locked = input.locked ?? new Set<string>();
  const byOccurrence: AllocationResult["byOccurrence"] = {};
  const byIngredient: AllocationResult["byIngredient"] = {};
  const keys = new Set<string>();
  for (const o of input.occurrences) for (const k in o.needs) keys.add(k);

  const sorted = [...input.occurrences].sort((a, b) => a.order - b.order || a.uid.localeCompare(b.uid));
  for (const o of input.occurrences) byOccurrence[o.uid] = {};

  for (const k of keys) {
    const rawStock = input.stock[k];
    let stockLeft =
      typeof rawStock === "number" ? Math.max(0, dec(rawStock - (input.reserved?.[k] ?? 0))) : 0;
    let purchaseLeft = Math.max(0, input.purchases[k] ?? 0);
    const tot: IngredientTotals = { need: 0, stock: 0, purchase: 0, deficit: 0, surplus: 0, discrepancy: 0 };

    const take = (want: number): Allocation => {
      const fromStock = Math.min(want, stockLeft);
      stockLeft = dec(stockLeft - fromStock);
      const fromPurchase = Math.min(dec(want - fromStock), purchaseLeft);
      purchaseLeft = dec(purchaseLeft - fromPurchase);
      return { stock: fromStock, purchase: fromPurchase, deficit: dec(want - fromStock - fromPurchase) };
    };

    // 1. Préparations verrouillées : leur part gelée est prélevée en premier, jamais réécrite.
    for (const o of sorted) {
      if (!locked.has(o.uid) || o.needs[k] === undefined) continue;
      const frozenQty = input.frozen?.[o.uid]?.[k] ?? o.needs[k]!;
      const a = take(frozenQty);
      byOccurrence[o.uid]![k] = a;
      tot.need += o.needs[k]!;
      tot.stock += a.stock;
      tot.purchase += a.purchase;
      // Ce qui manque à une préparation figée est un écart à vérifier, pas un déficit réallouable.
      tot.discrepancy += a.deficit;
    }
    // 2. Préparations modifiables.
    for (const o of sorted) {
      if (locked.has(o.uid) || o.needs[k] === undefined) continue;
      const a = take(o.needs[k]!);
      byOccurrence[o.uid]![k] = a;
      tot.need += o.needs[k]!;
      tot.stock += a.stock;
      tot.purchase += a.purchase;
      tot.deficit += a.deficit;
    }
    tot.surplus = purchaseLeft;
    for (const f of ["need", "stock", "purchase", "deficit", "discrepancy"] as const) tot[f] = dec(tot[f]);
    byIngredient[k] = tot;
  }
  return { byOccurrence, byIngredient };
}

/**
 * Stock restant pour chaque semaine, dans l'ordre : une semaine ne réutilise pas la part réservée par les
 * précédentes (AC-11). Un stock « assez » (`null`) ne peut pas couvrir deux semaines : à partir de la
 * seconde semaine qui en a besoin, l'ingrédient est « à vérifier » tant qu'une quantité mesurée manque (AC-25).
 */
export function stockPerWeek(
  stock: Readonly<Record<string, number | null | undefined>>,
  weekNeeds: readonly Totals[],
): { available: Record<string, number | null | undefined>; unverified: Set<string> }[] {
  const left: Record<string, number | null | undefined> = { ...stock };
  const claimedAssez = new Set<string>();
  return weekNeeds.map((needs) => {
    const available = { ...left };
    const unverified = new Set<string>();
    for (const k in needs) {
      const have = left[k];
      if (have === null) {
        if (claimedAssez.has(k)) unverified.add(k);
        claimedAssez.add(k);
      } else if (typeof have === "number") left[k] = Math.max(0, dec(have - Math.min(have, needs[k]!)));
    }
    return { available, unverified };
  });
}
