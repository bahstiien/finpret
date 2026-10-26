import "server-only";
import type { Env } from "@/engine/env";
import { fmtQ, fmtRaw } from "@/engine/format";
import {
  type CoverageStatus,
  type IssueDecision,
  availableBalance,
  coverage,
  type PurchaseEvent,
  recommendPacks,
  weekRevision,
} from "@/engine/purchases";
import { shoppingNeeds } from "@/engine/shopping";
import type { PortionModel } from "@/engine/portions";
import type { Pantry, WeekPlan } from "@/engine/types";
import { createClient } from "@/lib/supabase/server";

/** Vue des achats réels d'une semaine pour l'écran Courses : besoin, acheté, reste, surplus, état. */

export type PurchaseLine = {
  status: CoverageStatus;
  need: string;
  /** Total acquis ; null quand la quantité reste à confirmer. */
  bought: string | null;
  /** Reste à acheter (hors « à vérifier »). */
  deficit: string | null;
  surplus: string | null;
  /** Suggestion de contenants couvrant 100 % du manque. */
  suggestion: string | null;
  /** Unités proposées à la saisie. */
  units: string[];
  /** Quantité suggérée (contenants à 100 %) dans l'unité du catalogue ; null si aucune conversion fiable. */
  suggestedQty: number | null;
  catalogUnit: string;
  issue: IssueDecision | null;
  /** Stock « assez » déclaré, couverture à confirmer pour ce besoin. */
  canConfirm: boolean;
  /** Quantité acquise disponible (unité du catalogue), pour une réaffectation vers une autre semaine. */
  balance: number;
};

const MASS = ["g", "kg"];
const VOLUME = ["ml", "l"];

function unitsFor(u: string): string[] {
  if (u === "g") return MASS;
  if (u === "ml") return VOLUME;
  return [u];
}

const fmt = (env: Env, k: string, q: number) => {
  const u = env.lib.ingredients[k]!.u;
  return u === "g" || u === "ml" ? fmtRaw(env.lib, k, q) : fmtQ(env.lib, k, q);
};

export async function loadPurchaseView(
  env: Env,
  week: { id: string; plan: WeekPlan },
  pm: PortionModel,
  pantry: Pantry,
  cakeOn: boolean,
  checked: ReadonlySet<string>,
  unverified: ReadonlySet<string> = new Set(),
): Promise<{ lines: Record<string, PurchaseLine>; revision: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_events")
    .select("id, week_id, ingredient_key, qty, type, op_key")
    .eq("week_id", week.id)
    .order("created_at");
  if (error) throw error;
  const log: PurchaseEvent[] = (data ?? []).map((r) => ({
    id: r.id,
    weekId: r.week_id,
    ingredient: r.ingredient_key,
    qty: Number(r.qty),
    type: r.type,
    opKey: r.op_key,
  }));
  const { data: issueRows, error: issueErr } = await supabase
    .from("shopping_issues")
    .select("ingredient_key, decision")
    .eq("week_id", week.id);
  if (issueErr) throw issueErr;
  const issues = new Map((issueRows ?? []).map((r) => [r.ingredient_key, r.decision]));
  const { data: confRows, error: confErr } = await supabase
    .from("coverage_confirmations")
    .select("ingredient_key, confirmed_need")
    .eq("week_id", week.id);
  if (confErr) throw confErr;
  const confirmed = new Map((confRows ?? []).map((r) => [r.ingredient_key, Number(r.confirmed_need)]));
  const withEvents = new Set(log.map((e) => e.ingredient));
  const lines: Record<string, PurchaseLine> = {};
  for (const [k, n] of Object.entries(shoppingNeeds(env, week.plan, pm, pantry, cakeOn))) {
    // Ancienne coche sans quantité enregistrée : jamais déduite du texte, à confirmer (AC-16).
    const legacy = checked.has(k) && !withEvents.has(k);
    const purchased = legacy ? null : availableBalance(log, week.id, k);
    // « Assez » déjà revendiqué par une semaine précédente : jamais couvert sans mesure (AC-25).
    const stock = unverified.has(k) ? null : n.stock;
    const c = coverage({
      need: n.need,
      stock,
      purchased,
      confirmedNeed: unverified.has(k) ? undefined : confirmed.get(k),
    });
    const pack = c.deficit && c.deficit > 0 ? recommendPacks(env.lib, k, c.deficit) : null;
    const ing = env.lib.ingredients[k]!;
    const packText =
      pack && pack.short === 0
        ? [
            pack.a && `${pack.a} × ${env.lib.packs[k]!.s[0]} ${ing.u}`,
            pack.b && `${pack.b} × ${env.lib.packs[k]!.s[1]} ${ing.u}`,
          ]
            .filter(Boolean)
            .join(" + ")
        : null;
    lines[k] = {
      status: c.status,
      need: fmt(env, k, n.need),
      bought: purchased === null || (purchased === 0 && !withEvents.has(k)) ? null : fmt(env, k, purchased),
      deficit: c.deficit && c.deficit > 0 ? fmt(env, k, c.deficit) : null,
      surplus: c.surplus > 0 ? fmt(env, k, c.surplus) : null,
      suggestion: packText,
      units: unitsFor(ing.u),
      suggestedQty: pack && pack.short === 0 ? pack.total : null,
      catalogUnit: ing.u,
      issue: issues.get(k) ?? null,
      canConfirm: n.stock === null && !unverified.has(k) && c.status === "to_verify",
      balance: purchased !== null && purchased > 0 ? purchased : 0,
    };
  }
  return { lines, revision: weekRevision(log, week.id) };
}
