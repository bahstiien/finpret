"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  applyReplacement,
  propose,
  type Proposal,
  type Replacement,
  type SelectedIssue,
} from "@/engine/adaptation";
import { fmtRaw } from "@/engine/format";
import { type Env } from "@/engine/env";
import { ensureOccurrenceIds, listOccurrences } from "@/engine/occurrences";
import { availableBalance, type PurchaseEvent } from "@/engine/purchases";
import type { WeekPlan } from "@/engine/types";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { toMenuSettings } from "@/lib/settings";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type LockState, lockedFor, loadLockState, pantryForWeek } from "@/server/allocations";
import { householdCan } from "@/server/entitlements-load";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { trackEvent } from "@/server/events";
import { allow } from "@/server/rate-limit";
import { requireHousehold } from "@/server/session";
import { syncShoppingItems } from "@/server/shopping";
import { engineEnvFor } from "@/server/weeks";

/**
 * Adaptation du menu aux courses réelles (lot L3) : aperçu, confirmation, annulation.
 * Les propositions sont calculées par le moteur pur à partir des données faisant autorité, jamais d'un plan
 * envoyé par le client. L'aperçu ne modifie rien ; la confirmation écrit plan et journal dans une transaction.
 */

const t = fr.purchases.adapt;
const MAX_SELECTED = 20;
const RULES_VERSION = "1";

type Gathered = {
  env: Env;
  plan: WeekPlan;
  weekVersion: string;
  purchaseRevision: number;
  purchases: Record<string, number>;
  stock: Record<string, number>;
  lock: LockState;
  issues: Record<string, SelectedIssue["decision"]>;
  pantryJson: string;
  ctx: Awaited<ReturnType<typeof loadHouseholdContext>>;
};

async function gather(householdId: string, weekId: string): Promise<Gathered | { error: string }> {
  const ctx = await loadHouseholdContext(householdId);
  const row = ctx.weeks.find((w) => w.id === weekId);
  if (!row) return { error: fr.menuActions.weekGone };
  const env = await engineEnvFor(ctx);
  const supabase = await createClient();

  // Identités des préparations : posées une fois, avec la version de la semaine relue.
  let plan = row.plan;
  let weekVersion = row.updated_at;
  const withIds = ensureOccurrenceIds(plan, () => crypto.randomUUID());
  if (JSON.stringify(withIds) !== JSON.stringify(plan)) {
    const { data, error } = await supabase
      .from("weeks")
      .update({ plan: withIds as unknown as Json })
      .eq("id", weekId)
      .eq("updated_at", row.updated_at)
      .select("updated_at")
      .maybeSingle();
    if (error) return { error: toUserMessage(error) };
    if (!data) return { error: t.conflict };
    plan = withIds;
    weekVersion = data.updated_at;
  }

  const [events, issueRows, confirmations] = await Promise.all([
    supabase
      .from("purchase_events")
      .select("id, week_id, ingredient_key, qty, type, op_key")
      .eq("week_id", weekId)
      .order("seq"),
    supabase.from("shopping_issues").select("ingredient_key, decision").eq("week_id", weekId),
    supabase.from("coverage_confirmations").select("ingredient_key, confirmed_need").eq("week_id", weekId),
  ]);
  if (events.error) return { error: toUserMessage(events.error) };
  if (issueRows.error) return { error: toUserMessage(issueRows.error) };
  if (confirmations.error) return { error: toUserMessage(confirmations.error) };

  const log: PurchaseEvent[] = (events.data ?? []).map((r) => ({
    id: r.id,
    weekId: r.week_id,
    ingredient: r.ingredient_key,
    qty: Number(r.qty),
    type: r.type,
    opKey: r.op_key,
  }));
  const purchases: Record<string, number> = {};
  for (const k of new Set(log.map((e) => e.ingredient))) purchases[k] = availableBalance(log, weekId, k);

  const shared = pantryForWeek(ctx, env, { id: weekId, start_date: row.start_date });
  const confirmed = new Map(
    (confirmations.data ?? []).map((c) => [c.ingredient_key, Number(c.confirmed_need)]),
  );
  const stock: Record<string, number> = {};
  for (const [k, v] of Object.entries(shared.pantry)) {
    // « Assez » ne vaut qu'à hauteur du besoin confirmé : jamais une quantité supposée (AC-12).
    stock[k] = v === null ? (shared.unverified.has(k) ? 0 : (confirmed.get(k) ?? 0)) : v;
  }
  return {
    env,
    plan,
    weekVersion,
    purchaseRevision: log.length,
    purchases,
    stock,
    lock: await loadLockState(weekId),
    issues: Object.fromEntries((issueRows.data ?? []).map((r) => [r.ingredient_key, r.decision])),
    pantryJson: JSON.stringify(shared.pantry),
    ctx,
  };
}

const fingerprint = (g: Gathered, selected: readonly SelectedIssue[]) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        RULES_VERSION,
        g.weekVersion,
        g.purchaseRevision,
        g.pantryJson,
        g.issues,
        g.lock,
        [...selected].sort((a, b) => a.ingredient.localeCompare(b.ingredient)),
      ]),
    )
    .digest("hex");

const recipeName = (env: Env, id: string) =>
  (env.mainById.get(id) ?? env.soupById.get(id) ?? env.simpleById.get(id))?.n ?? id;

function compute(g: Gathered, selected: readonly SelectedIssue[]) {
  const pm = portionModelFor(g.ctx, g.plan.start);
  const cakeOn = g.ctx.settings.menu.cake.enabled;
  const occs = listOccurrences(g.env, g.plan, pm, cakeOn);
  const result = propose({
    env: g.env,
    week: g.plan,
    pm,
    cakeOn,
    locked: lockedFor(occs, g.lock),
    selected,
    stock: g.stock,
    purchases: g.purchases,
    settings: toMenuSettings(g.ctx.settings),
  });
  return { result, occs };
}

const sig = (reps: readonly Replacement[]) =>
  reps
    .map((r) => `${r.uid}:${r.recipeId}`)
    .sort()
    .join("|");

export type ProposalView = {
  replacements: Replacement[];
  lines: { from: string; to: string; slots: string[] }[];
  resolved: number;
  total: number;
  remaining: string[];
  extra: string[];
  reused: string[];
  durationDelta: number;
};

export type PreviewData = {
  previewId: string;
  proposals: ProposalView[];
  limited: boolean;
  excluded: { name: string; reason: "locked" | "unsupported" }[];
};

const previewInput = z.object({
  weekId: z.uuid(),
  ingredients: z.array(z.string().min(1).max(60)).min(1).max(MAX_SELECTED),
});

export async function previewAdaptation(
  raw: z.infer<typeof previewInput>,
): Promise<ActionResult<PreviewData>> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household, user } = await requireHousehold("/app/shopping");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "purchases"))) return { ok: false, error: fr.errors.upgrade };
  const started = Date.now();
  const parsed = previewInput.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: raw?.ingredients?.length > MAX_SELECTED ? t.tooMany : t.pickOne };
  // 30 demandes d'aperçu par minute et par foyer (§18).
  if (!allow(`preview:${household.id}`, 30, 60_000)) return { ok: false, error: fr.errors.generic };
  const g = await gather(household.id, parsed.data.weekId);
  if ("error" in g) return { ok: false, error: g.error };

  const selected: SelectedIssue[] = [...new Set(parsed.data.ingredients)].map((ingredient) => ({
    ingredient,
    decision: g.issues[ingredient] ?? "open",
  }));
  const { result, occs } = compute(g, selected);
  const label = (k: string) => g.env.lib.ingredients[k]?.l ?? k;
  const qty = (k: string, q: number) => `${label(k)} (${fmtRaw(g.env.lib, k, q)})`;
  const slotName = (k: string) => {
    const [d, m] = k.split("-") as [string, "lunch" | "dinner"];
    return `${fr.days[Number(d) - 1]} ${fr.meals[m].toLowerCase()}`;
  };
  const proposals: ProposalView[] = result.proposals.map((p: Proposal) => ({
    replacements: p.replacements,
    lines: p.replacements.map((r) => {
      const occ = occs.find((o) => o.uid === r.uid)!;
      return {
        from: recipeName(g.env, occ.recipeId),
        to: recipeName(g.env, r.recipeId),
        slots: occ.slots.map(slotName),
      };
    }),
    resolved: p.resolved.length,
    total: selected.length,
    remaining: p.remaining.map(label),
    extra: p.extraPurchases.map((e) => qty(e.ingredient, e.qty)),
    reused: p.reusedPurchases.map((e) => qty(e.ingredient, e.qty)),
    durationDelta: Math.round(p.durationDelta),
  }));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adaptation_previews")
    .insert({
      household_id: household.id,
      week_id: parsed.data.weekId,
      fingerprint: fingerprint(g, selected),
      payload: {
        selected,
        proposals: result.proposals.map((p) => p.replacements),
      } as unknown as Json,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error) };
  await trackEvent(proposals.length ? "adaptation_previewed" : "adaptation_no_verified_candidate", {
    userId: user.id,
    householdId: household.id,
    props: {
      selected: selected.length,
      proposals: proposals.length,
      evaluated: result.evaluated,
      limited: result.limited,
      ms: Date.now() - started,
    },
  });
  return {
    ok: true,
    data: {
      previewId: data.id,
      proposals,
      limited: result.limited,
      excluded: result.excluded.map((e) => ({
        name: recipeName(g.env, occs.find((o) => o.uid === e.uid)?.recipeId ?? ""),
        reason: e.reason,
      })),
    },
  };
}

const commitInput = z.object({
  previewId: z.uuid(),
  proposalIndex: z.number().int().min(0).max(2),
  opKey: z.string().min(8).max(128),
});

function adaptationError(e: { code?: string; message?: string }): string {
  const map: Record<string, string> = {
    version_conflict: t.conflict,
    preview_expired: t.expired,
    preview_used: t.used,
    preparation_locked: t.locked,
    idempotency_conflict: t.conflict,
    already_undone: t.notRevertible,
  };
  const hit = Object.entries(map).find(([code]) => e.message === code);
  if (hit) return hit[1];
  return e.code === "42501" ? fr.errors.forbidden : fr.purchases.failed;
}

/**
 * « Appliquer ces changements » : le serveur recalcule les propositions à partir des données actuelles ; la
 * proposition choisie doit encore y figurer. Plan, journal et aperçu consommé sont écrits dans une seule transaction.
 */
export async function commitAdaptation(
  raw: z.infer<typeof commitInput>,
): Promise<ActionResult<{ message: string }>> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household, user } = await requireHousehold("/app/shopping");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "purchases"))) return { ok: false, error: fr.errors.upgrade };
  const parsed = commitInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: t.invalid };
  const p = parsed.data;

  const supabase = await createClient();
  const { data: preview, error: pe } = await supabase
    .from("adaptation_previews")
    .select("id, week_id, payload, fingerprint, expires_at, used_at")
    .eq("id", p.previewId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (pe) return { ok: false, error: toUserMessage(pe) };
  if (!preview) return { ok: false, error: t.invalid };
  if (preview.used_at) return { ok: false, error: t.used };
  if (new Date(preview.expires_at) <= new Date()) return { ok: false, error: t.expired };

  const payload = preview.payload as unknown as { selected: SelectedIssue[]; proposals: Replacement[][] };
  const chosen = payload.proposals[p.proposalIndex];
  if (!chosen) return { ok: false, error: t.invalid };

  const g = await gather(household.id, preview.week_id);
  if ("error" in g) return { ok: false, error: g.error };
  const fresh = fingerprint(g, payload.selected);
  const conflict = async () => {
    await trackEvent("adaptation_conflict", { userId: user.id, householdId: household.id });
    return { ok: false as const, error: t.conflict };
  };
  if (fresh !== preview.fingerprint) return conflict();

  // Contraintes recalculées côté serveur : la proposition doit toujours être vérifiée par le moteur.
  const { result, occs } = compute(g, payload.selected);
  if (!result.proposals.some((x) => sig(x.replacements) === sig(chosen)))
    return { ok: false, error: t.invalid };

  let plan: WeekPlan = g.plan;
  const changes = chosen.map((r) => {
    const occ = occs.find((o) => o.uid === r.uid)!;
    const next = applyReplacement(plan, r)!;
    plan = next;
    return { uid: r.uid, kind: occ.kind, before: occ.recipeId, after: r.recipeId };
  });

  const { data, error } = await supabase.rpc("commit_adaptation", {
    p_preview: p.previewId,
    p_op_key: p.opKey,
    p_expected_week_version: g.weekVersion,
    p_expected_purchase_revision: g.purchaseRevision,
    p_fingerprint: fresh,
    p_plan: plan as unknown as Json,
    p_changes: changes as unknown as Json,
  });
  if (error) {
    if (error.message === "version_conflict") return conflict();
    return { ok: false, error: adaptationError(error) };
  }
  if (!(data as { replayed: boolean }).replayed) {
    await trackEvent("adaptation_committed", {
      userId: user.id,
      householdId: household.id,
      props: { replaced: changes.length },
    });
    // Les achats déjà enregistrés sont conservés par la synchronisation (lignes à achats non supprimées).
    await syncShoppingItems(g.ctx, g.env, { id: preview.week_id, plan });
    revalidatePath("/app", "layout");
  }
  return { ok: true, data: { message: t.applied } };
}

const undoInput = z.object({ eventId: z.uuid(), opKey: z.string().min(8).max(128) });

/**
 * Annule une adaptation si les préparations concernées n'ont pas changé depuis et ne sont pas verrouillées.
 * L'annulation est une nouvelle opération journalisée ; les achats récents sont conservés.
 */
export async function undoAdaptation(
  raw: z.infer<typeof undoInput>,
): Promise<ActionResult<{ message: string }>> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household, user } = await requireHousehold("/app/shopping");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "purchases"))) return { ok: false, error: fr.errors.upgrade };
  const parsed = undoInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: t.invalid };
  const supabase = await createClient();
  const { data: ev, error: ee } = await supabase
    .from("adaptation_events")
    .select("id, week_id, changes, kind, undone_by")
    .eq("id", parsed.data.eventId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (ee) return { ok: false, error: toUserMessage(ee) };
  if (!ev || ev.kind !== "apply" || ev.undone_by) return { ok: false, error: t.notRevertible };

  const g = await gather(household.id, ev.week_id);
  if ("error" in g) return { ok: false, error: g.error };
  const changes = ev.changes as unknown as { uid: string; kind: string; before: string; after: string }[];
  const occs = listOccurrences(
    g.env,
    g.plan,
    portionModelFor(g.ctx, g.plan.start),
    g.ctx.settings.menu.cake.enabled,
  );
  // Chaque préparation doit encore porter la recette appliquée par l'adaptation, sans modification ultérieure.
  const intact = changes.every((c) => occs.find((o) => o.uid === c.uid)?.recipeId === c.after);
  if (!intact) return { ok: false, error: t.notRevertible };
  if (changes.some((c) => lockedFor(occs, g.lock).has(c.uid))) return { ok: false, error: t.locked };

  let plan: WeekPlan = g.plan;
  for (const c of changes) plan = applyReplacement(plan, { uid: c.uid, recipeId: c.before })!;
  const reverse = changes.map((c) => ({ uid: c.uid, kind: c.kind, before: c.after, after: c.before }));
  const { data, error } = await supabase.rpc("undo_adaptation", {
    p_event: ev.id,
    p_op_key: parsed.data.opKey,
    p_expected_week_version: g.weekVersion,
    p_plan: plan as unknown as Json,
    p_changes: reverse as unknown as Json,
  });
  if (error) return { ok: false, error: adaptationError(error) };
  if (!(data as { replayed: boolean }).replayed) {
    await trackEvent("adaptation_undone", { userId: user.id, householdId: household.id });
    await syncShoppingItems(g.ctx, g.env, { id: ev.week_id, plan });
    revalidatePath("/app", "layout");
  }
  return { ok: true, data: { message: t.undoneMsg } };
}
