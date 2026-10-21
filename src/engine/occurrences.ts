import type { Env } from "./env";
import { mealPd, type PortionModel } from "./portions";
import { scaleIngredients, type Totals } from "./quantities";
import type { WeekPlan } from "./types";
import { activeCake, activeMains, activeSimples, activeSoup, weekendItems } from "./week";

/**
 * Occurrences de préparation (courses réelles, lot L2) : une cuisson = une occurrence, quel que soit le nombre
 * de repas qu'elle sert. Identité stable (`uid`), indépendante de la recette et de l'indice dans le plan.
 */

export type OccurrenceKind = "main" | "soup" | "simple" | "weekend" | "cake";

export type Occurrence = {
  uid: string;
  kind: OccurrenceKind;
  recipeId: string;
  /** Créneaux servis par cette préparation (« 3-dinner »), actifs uniquement. */
  slots: string[];
  /** Besoin culinaire de la préparation, une seule fois pour toutes ses portions. */
  needs: Totals;
};

/** Donne une identité stable aux préparations qui n'en ont pas encore. Les identités existantes sont conservées. */
export function ensureOccurrenceIds(week: WeekPlan, newId: () => string): WeekPlan {
  const w = structuredClone(week);
  for (const g of w.groups) g.uid ??= newId();
  if (w.soup) w.soup.uid ??= newId();
  for (const s of w.simples) s.uid ??= newId();
  return w;
}

/**
 * Préparations actives de la semaine avec leur besoin. La somme des besoins égale `totals` (même arrondi).
 * Sans `uid` persisté, l'identité est dérivée du créneau ou de l'indice : utilisable pour lire, pas pour verrouiller.
 */
export function listOccurrences(env: Env, w: WeekPlan, pm: PortionModel, cakeOn: boolean): Occurrence[] {
  const out: Occurrence[] = [];
  for (const x of activeMains(env, w, pm)) {
    if (!x.P) continue;
    out.push({
      uid: w.groups[x.i]!.uid ?? `main:${x.i}`,
      kind: "main",
      recipeId: w.groups[x.i]!.id,
      slots: x.meals.map((m) => `${m.day}-${m.meal}`),
      needs: scaleIngredients(env, x.r.ing, x.cookP / 4),
    });
  }
  const so = activeSoup(env, w, pm);
  if (so && so.P && w.soup) {
    out.push({
      uid: w.soup.uid ?? "soup",
      kind: "soup",
      recipeId: w.soup.id,
      slots: so.days.map((d) => `${d}-dinner`),
      needs: scaleIngredients(env, so.r.ing, so.P / 4),
    });
  }
  for (const s of activeSimples(env, w)) {
    if (!s.on) continue;
    out.push({
      uid: w.simples[s.i]!.uid ?? `simple:${s.day}`,
      kind: "simple",
      recipeId: w.simples[s.i]!.id,
      slots: [`${s.day}-dinner`],
      needs: scaleIngredients(env, s.r.ing, mealPd(w, pm, s.day, "dinner") / 4),
    });
  }
  const ck = activeCake(env, w, cakeOn);
  if (ck)
    out.push({
      uid: "cake",
      kind: "cake",
      recipeId: w.cake,
      slots: [],
      needs: scaleIngredients(env, ck.ing, 1),
    });
  for (const x of weekendItems(env, w)) {
    out.push({
      uid: `weekend:${x.k}`,
      kind: "weekend",
      recipeId: x.id,
      slots: [x.k],
      needs: scaleIngredients(env, x.r.ing, mealPd(w, pm, x.d, x.m) / 4),
    });
  }
  return out;
}

/** Besoin total par ingrédient : somme des occurrences. */
export function sumNeeds(occurrences: readonly Occurrence[]): Totals {
  const t: Totals = {};
  for (const o of occurrences) for (const k in o.needs) t[k] = (t[k] ?? 0) + o.needs[k]!;
  return t;
}

/**
 * Occurrences dont le contenu diffère entre deux plans (recette, créneaux ou besoin) ou qui apparaissent
 * ou disparaissent. Sert à refuser une modification qui toucherait une préparation verrouillée.
 */
export function changedOccurrences(before: readonly Occurrence[], after: readonly Occurrence[]): string[] {
  const a = new Map(before.map((o) => [o.uid, o]));
  const b = new Map(after.map((o) => [o.uid, o]));
  const changed: string[] = [];
  for (const [uid, o] of a) {
    const n = b.get(uid);
    if (!n || n.recipeId !== o.recipeId || n.slots.join() !== o.slots.join() || !sameNeeds(o.needs, n.needs))
      changed.push(uid);
  }
  for (const uid of b.keys()) if (!a.has(uid)) changed.push(uid);
  return changed;
}

const sameNeeds = (x: Totals, y: Totals) => {
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  for (const k of keys) if (Math.abs((x[k] ?? 0) - (y[k] ?? 0)) > 1e-9) return false;
  return true;
};

export type PreparationState = "planned" | "started" | "prepared" | "cancelled";

/** Une préparation commencée ou préparée est protégée ; `planned` et `cancelled` restent modifiables (§14). */
export const isProtected = (s: PreparationState) => s === "started" || s === "prepared";

/** Préparations verrouillées : toutes si la session de batch a démarré, sinon celles marquées individuellement. */
export function lockedUids(
  occurrences: readonly Occurrence[],
  states: Readonly<Record<string, PreparationState>>,
  sessionStarted: boolean,
): Set<string> {
  const out = new Set<string>();
  for (const o of occurrences) if (sessionStarted || isProtected(states[o.uid] ?? "planned")) out.add(o.uid);
  return out;
}
