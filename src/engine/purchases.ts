import type { Library } from "./types";

/**
 * Achats réels (spec « Adapter le menu aux courses réelles », lot L1) : quantités structurées, journal
 * d'événements, soldes, couverture et recommandation de contenants à 100 %. Pur : aucun accès base.
 * Un recalcul des besoins ne touche jamais au journal : les besoins sont dérivés, les achats sont des faits.
 */

export type PurchaseErrorCode =
  | "INVALID_QUANTITY"
  | "INCOMPATIBLE_UNIT"
  | "UNVERIFIED_QUANTITY"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INSUFFICIENT_AVAILABLE_QUANTITY";

export type Result<T> = { ok: true; value: T } | { ok: false; code: PurchaseErrorCode };
const fail = (code: PurchaseErrorCode): { ok: false; code: PurchaseErrorCode } => ({ ok: false, code });

/** Bornes de saisie par opération (§9.1) : protections de validation. */
export const MAX_MASS_VOLUME = 100_000;
export const MAX_COUNT = 1_000;

/** Précision décimale : les conversions n'accumulent pas de bruit binaire. */
const dec = (x: number) => Math.round(x * 1e6) / 1e6;

const FACTORS: Record<string, { base: "g" | "ml"; f: number }> = {
  g: { base: "g", f: 1 },
  kg: { base: "g", f: 1000 },
  ml: { base: "ml", f: 1 },
  l: { base: "ml", f: 1000 },
};
const CONTAINER_WORDS = new Set(["paquet", "sachet", "pack"]);

/** Quantité structurée convertie dans l'unité du catalogue de l'ingrédient. */
export function toCatalogUnit(lib: Library, key: string, qty: number, unit: string): Result<number> {
  const ing = lib.ingredients[key];
  if (!ing) return fail("INCOMPATIBLE_UNIT");
  if (!Number.isFinite(qty) || qty < 0) return fail("INVALID_QUANTITY");
  const conv = FACTORS[unit];
  let q: number;
  if (conv) {
    if (conv.base !== ing.u) return fail("INCOMPATIBLE_UNIT");
    q = dec(qty * conv.f);
  } else if (unit === ing.u && (unit === "pc" || unit === "boite" || unit === "cs" || unit === "cc")) {
    q = dec(qty);
  } else {
    // « paquet », « sachet » : un contenant n'est pas une unité sans poids connu (AC-14).
    return fail(CONTAINER_WORDS.has(unit) ? "UNVERIFIED_QUANTITY" : "INCOMPATIBLE_UNIT");
  }
  const max = ing.u === "g" || ing.u === "ml" ? MAX_MASS_VOLUME : MAX_COUNT;
  if (q > max) return fail("INVALID_QUANTITY");
  if (ing.u === "pc" && !ing.half && !Number.isInteger(q)) return fail("INVALID_QUANTITY");
  return { ok: true, value: q };
}

/** Total des contenants déclarés (« 2 × 350 g ») dans l'unité du catalogue. */
export function containersTotal(
  lib: Library,
  key: string,
  containers: readonly { n: number; size: number; unit: string }[],
): Result<number> {
  let total = 0;
  for (const c of containers) {
    if (!Number.isInteger(c.n) || c.n < 0) return fail("INVALID_QUANTITY");
    const one = toCatalogUnit(lib, key, c.size, c.unit);
    if (!one.ok) return one;
    total += one.value * c.n;
  }
  const max =
    lib.ingredients[key]?.u === "g" || lib.ingredients[key]?.u === "ml" ? MAX_MASS_VOLUME : MAX_COUNT;
  return total > max ? fail("INVALID_QUANTITY") : { ok: true, value: dec(total) };
}

export type PurchaseEventType = "purchase" | "correction" | "transfer_out" | "transfer_in";

export type PurchaseEvent = {
  id: string;
  weekId: string;
  ingredient: string;
  /** Quantité dans l'unité du catalogue. Pour `correction` : nouveau total brut acquis. */
  qty: number;
  type: PurchaseEventType;
  /** Clé d'idempotence, unique dans le foyer. */
  opKey: string;
  author?: string;
  at?: string;
};

export type PurchaseDraft = Omit<PurchaseEvent, "id">;

const sameContent = (a: PurchaseDraft, b: PurchaseEvent) =>
  a.weekId === b.weekId && a.ingredient === b.ingredient && a.qty === b.qty && a.type === b.type;

export const weekRevision = (log: readonly PurchaseEvent[], weekId: string) =>
  log.filter((e) => e.weekId === weekId).length;

const forIngredient = (log: readonly PurchaseEvent[], weekId: string, ingredient: string) =>
  log.filter((e) => e.weekId === weekId && e.ingredient === ingredient);

/**
 * Acquisition brute : dernier total corrigé (ou 0) plus les achats déclarés depuis. « Modifier le total »
 * remplace (400 → 700 donne 700) ; « Ajouter un achat » additionne (§8.2).
 */
export function grossAcquired(log: readonly PurchaseEvent[], weekId: string, ingredient: string): number {
  let total = 0;
  for (const e of forIngredient(log, weekId, ingredient)) {
    if (e.type === "correction") total = e.qty;
    else if (e.type === "purchase") total = dec(total + e.qty);
  }
  return total;
}

/** Solde disponible : acquisition brute moins transferts sortants plus transferts entrants. */
export function availableBalance(log: readonly PurchaseEvent[], weekId: string, ingredient: string): number {
  let out = 0;
  let inn = 0;
  for (const e of forIngredient(log, weekId, ingredient)) {
    if (e.type === "transfer_out") out += e.qty;
    else if (e.type === "transfer_in") inn += e.qty;
  }
  return dec(grossAcquired(log, weekId, ingredient) - out + inn);
}

/**
 * Ajoute un événement au journal (append-only). Même clé et même contenu : renvoie l'événement initial
 * sans rien ajouter (AC-09). Même clé, autre contenu : refus. `expectedRevision` (nombre d'événements
 * de la semaine vus par le client) protège contre une écriture sur un état périmé. Une correction ou un
 * transfert qui rendrait le solde négatif est refusé : il exige un rapprochement (§9.7).
 */
export function appendEvent(
  log: readonly PurchaseEvent[],
  draft: PurchaseDraft,
  opts: { expectedRevision?: number; newId: () => string },
): Result<{ log: PurchaseEvent[]; event: PurchaseEvent; replayed: boolean }> {
  const prior = log.find((e) => e.opKey === draft.opKey);
  if (prior) {
    return sameContent(draft, prior)
      ? { ok: true, value: { log: [...log], event: prior, replayed: true } }
      : fail("IDEMPOTENCY_CONFLICT");
  }
  if (!Number.isFinite(draft.qty) || draft.qty < 0) return fail("INVALID_QUANTITY");
  if (opts.expectedRevision !== undefined && opts.expectedRevision !== weekRevision(log, draft.weekId))
    return fail("VERSION_CONFLICT");
  const event = { ...draft, id: opts.newId() };
  const next = [...log, event];
  if (
    (draft.type === "correction" || draft.type === "transfer_out") &&
    availableBalance(next, draft.weekId, draft.ingredient) < 0
  )
    return fail("INSUFFICIENT_AVAILABLE_QUANTITY");
  return { ok: true, value: { log: next, event, replayed: false } };
}

export type CoverageStatus = "to_verify" | "uncovered" | "partial" | "covered" | "surplus";

export type Coverage = {
  status: CoverageStatus;
  need: number;
  stockAllocated: number;
  purchaseAllocated: number;
  /** Reste à acheter ; `null` quand une quantité inconnue empêche de conclure. */
  deficit: number | null;
  surplus: number;
};

/**
 * Couverture d'un besoin (§9.2, §9.5). Le stock est alloué avant les achats (§9.3).
 * - `stock` : quantité, `null` (« assez », valable seulement si `confirmedNeed` couvre le besoin), ou absent.
 * - `purchased` : total acquis, ou `null` si la quantité reste à confirmer (ancienne coche) : jamais zéro.
 */
export function coverage(input: {
  need: number;
  stock?: number | null;
  purchased: number | null;
  confirmedNeed?: number;
}): Coverage {
  const need = Math.max(0, input.need);
  const unknown: Coverage = {
    status: "to_verify",
    need,
    stockAllocated: 0,
    purchaseAllocated: 0,
    deficit: null,
    surplus: 0,
  };
  if (input.stock === null) {
    // Couverture déclarée suffisante : liée au besoin confirmé, jamais étendue à un besoin plus grand.
    return input.confirmedNeed !== undefined && input.confirmedNeed >= need
      ? { status: "covered", need, stockAllocated: need, purchaseAllocated: 0, deficit: 0, surplus: 0 }
      : unknown;
  }
  if (input.purchased === null) return unknown;
  const stockAllocated = Math.min(need, Math.max(0, input.stock ?? 0));
  const afterStock = dec(need - stockAllocated);
  const purchaseAllocated = Math.min(afterStock, input.purchased);
  const deficit = dec(afterStock - purchaseAllocated);
  const surplus = dec(Math.max(0, input.purchased - purchaseAllocated));
  const status: CoverageStatus =
    deficit > 0
      ? stockAllocated + purchaseAllocated > 0
        ? "partial"
        : "uncovered"
      : surplus > 0
        ? "surplus"
        : "covered";
  return { status, need, stockAllocated, purchaseAllocated, deficit, surplus };
}

/**
 * Combinaison de contenants couvrant 100 % du déficit (évolution de la règle historique à 97 %, §9.4).
 * `short` > 0 si aucune combinaison de 12 contenants au plus ne couvre : le manque reste affiché.
 */
export function recommendPacks(
  lib: Library,
  key: string,
  deficit: number,
): { a: number; b: number; total: number; short: number } | null {
  const p = lib.packs[key];
  if (!p || !(deficit > 0)) return null;
  const [s0, s1] = p.s;
  let best: { a: number; b: number; total: number } | null = null;
  let largest = 0;
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= (s1 ? 12 : 0); b++) {
      const total = a * s0! + (s1 ? b * s1 : 0);
      if (total === 0) continue;
      largest = Math.max(largest, total);
      if (total < deficit) continue;
      if (!best || total < best.total || (total === best.total && a + b < best.a + best.b))
        best = { a, b, total };
    }
  }
  return best ? { ...best, short: 0 } : { a: 0, b: 0, total: 0, short: dec(deficit - largest) };
}

/**
 * Lignes « menu » à retirer de la liste après un recalcul : celles dont l'ingrédient n'est plus voulu
 * par le menu, sauf si un achat réel est enregistré (un achat ne disparaît jamais lors d'un recalcul).
 */
export function removableMenuKeys(
  existing: readonly string[],
  wanted: readonly string[],
  purchased: ReadonlySet<string>,
): string[] {
  const keep = new Set(wanted);
  return existing.filter((k) => !keep.has(k) && !purchased.has(k));
}

export type IssueDecision = "open" | "search_elsewhere" | "no_more";

/**
 * Bilan « Vérifier mes courses » (§8.4) : quantités connues, quantités à confirmer, manques non résolus,
 * surplus. « Terminer mes courses » n'affirme jamais que le menu est réalisable : `unresolved` compte
 * ce qui reste à résoudre (manque ou quantité inconnue), `ready` n'est vrai que si rien ne reste.
 */
export function reviewSummary(
  lines: readonly { key: string; status: CoverageStatus; issue?: IssueDecision | null }[],
): {
  known: string[];
  toConfirm: string[];
  missing: string[];
  surplus: string[];
  unresolved: number;
  ready: boolean;
} {
  const known: string[] = [];
  const toConfirm: string[] = [];
  const missing: string[] = [];
  const surplus: string[] = [];
  for (const l of lines) {
    if (l.status === "to_verify") toConfirm.push(l.key);
    else if (l.status === "partial" || l.status === "uncovered") missing.push(l.key);
    else known.push(l.key);
    if (l.status === "surplus") surplus.push(l.key);
  }
  const unresolved = toConfirm.length + missing.length;
  return { known, toConfirm, missing, surplus, unresolved, ready: unresolved === 0 };
}
