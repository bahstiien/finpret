"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  appendEvent,
  type PurchaseEvent,
  type PurchaseErrorCode,
  type PurchaseEventType,
  toCatalogUnit,
  weekRevision,
} from "@/engine/purchases";
import { ensureOccurrenceIds, listOccurrences } from "@/engine/occurrences";
import { shoppingNeeds } from "@/engine/shopping";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { householdCan } from "@/server/entitlements-load";
import { pantryForWeek } from "@/server/allocations";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { allow } from "@/server/rate-limit";
import { requireHousehold } from "@/server/session";
import { engineEnvFor } from "@/server/weeks";

/**
 * Achats réels (courses réelles, lot L1) : déclarer un achat ou corriger le total d'un ingrédient.
 * Le serveur valide la quantité et l'unité, vérifie le rôle, la clé d'idempotence et la révision,
 * puis ajoute un événement au journal. Les besoins ne sont jamais modifiés ici.
 */

const t = fr.purchases;
type Result = ActionResult<{ message: string; revision: number }>;

const input = z.object({
  weekId: z.uuid(),
  ingredient: z.string().min(1).max(60),
  qty: z.number().finite().min(0).max(100000),
  unit: z.enum(["g", "kg", "ml", "l", "pc", "boite", "cs", "cc", "paquet", "sachet", "pack"]),
  /** Nombre d'événements de la semaine vus par le client ; une valeur périmée est refusée. */
  expectedRevision: z.number().int().min(0).optional(),
  opKey: z.string().min(8).max(128),
});

type Input = z.infer<typeof input>;

const rowToEvent = (r: {
  id: string;
  week_id: string;
  ingredient_key: string;
  qty: number;
  type: PurchaseEventType;
  op_key: string;
}): PurchaseEvent => ({
  id: r.id,
  weekId: r.week_id,
  ingredient: r.ingredient_key,
  qty: Number(r.qty),
  type: r.type,
  opKey: r.op_key,
});

async function write(raw: Input, type: "purchase" | "correction", okMessage: string): Promise<Result> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household, user } = await requireHousehold("/app/courses");
  // Lecture seule : consultation uniquement pour cette fonctionnalité.
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "purchases"))) return { ok: false, error: fr.errors.upgrade };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: t.INVALID_QUANTITY };
  const p = parsed.data;
  if (!allow(`purchase:${household.id}`, 60, 60_000)) return { ok: false, error: fr.errors.generic };

  const ctx = await loadHouseholdContext(household.id);
  const week = ctx.weeks.find((w) => w.id === p.weekId);
  if (!week) return { ok: false, error: fr.menuActions.weekGone };
  const { lib } = await engineEnvFor(ctx);
  const q = toCatalogUnit(lib, p.ingredient, p.qty, p.unit);
  if (!q.ok) return { ok: false, error: t[q.code] };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("purchase_events")
    .select("id, week_id, ingredient_key, qty, type, op_key")
    .eq("household_id", household.id)
    .eq("week_id", p.weekId)
    .order("created_at");
  if (error) return { ok: false, error: toUserMessage(error) };
  const log = (rows ?? []).map(rowToEvent);

  // La clé d'idempotence est unique dans le foyer : on la cherche aussi hors de cette semaine.
  const { data: dup } = await supabase
    .from("purchase_events")
    .select("id, week_id, ingredient_key, qty, type, op_key")
    .eq("household_id", household.id)
    .eq("op_key", p.opKey)
    .maybeSingle();
  const full = dup && !log.some((e) => e.id === dup.id) ? [...log, rowToEvent(dup)] : log;

  const res = appendEvent(
    full,
    { weekId: p.weekId, ingredient: p.ingredient, qty: q.value, type, opKey: p.opKey, author: user.id },
    { expectedRevision: p.expectedRevision, newId: () => crypto.randomUUID() },
  );
  if (!res.ok) return { ok: false, error: t[res.code as PurchaseErrorCode] };
  const { event, replayed, log: next } = res.value;
  if (!replayed) {
    const { error: e } = await supabase.from("purchase_events").insert({
      household_id: household.id,
      week_id: event.weekId,
      ingredient_key: event.ingredient,
      qty: event.qty,
      type,
      op_key: event.opKey,
    });
    if (e) {
      // Course entre deux appareils avec la même clé : l'autre écriture fait foi, rien n'est compté deux fois.
      if (e.code === "23505")
        return { ok: true, data: { message: t.replayed, revision: weekRevision(log, p.weekId) } };
      return { ok: false, error: t.failed };
    }
    revalidatePath("/app", "layout");
  }
  return {
    ok: true,
    data: { message: replayed ? t.replayed : okMessage, revision: weekRevision(next, p.weekId) },
  };
}

/** « Ajouter un achat » : additionne à ce qui est déjà enregistré. */
export async function recordPurchase(raw: Input): Promise<Result> {
  return write(raw, "purchase", t.saved);
}

/** « Modifier le total » : remplace le total acheté de la semaine (400 → 700 donne 700, pas 1 100). */
export async function setPurchasedTotal(raw: Input): Promise<Result> {
  return write(raw, "correction", t.totalSaved);
}

const issueInput = z.object({
  weekId: z.uuid(),
  ingredient: z.string().min(1).max(60),
  decision: z.enum(["open", "search_elsewhere", "no_more"]),
});

/**
 * « Introuvable » : signalement daté pour cette course. Il conserve tous les achats déjà enregistrés et ne
 * modifie aucun menu. Un nouveau choix (« chercher ailleurs », « ne plus en acheter ») remplace le précédent.
 */
export async function reportShoppingIssue(
  raw: z.infer<typeof issueInput>,
): Promise<ActionResult<{ message: string }>> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household } = await requireHousehold("/app/shopping");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "purchases"))) return { ok: false, error: fr.errors.upgrade };
  const parsed = issueInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: t.INVALID_QUANTITY };
  const p = parsed.data;
  if (!allow(`issue:${household.id}`, 60, 60_000)) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("shopping_issues")
    .select("id")
    .eq("week_id", p.weekId)
    .eq("ingredient_key", p.ingredient)
    .maybeSingle();
  if (error) return { ok: false, error: toUserMessage(error) };
  if (!existing) {
    const { error: e } = await supabase
      .from("shopping_issues")
      .insert({ household_id: household.id, week_id: p.weekId, ingredient_key: p.ingredient });
    if (e) return { ok: false, error: toUserMessage(e) };
  }
  // La décision par défaut est « à résoudre » ; tout autre choix passe par une mise à jour.
  if (existing || p.decision !== "open") {
    const { error: e } = await supabase
      .from("shopping_issues")
      .update({ decision: p.decision })
      .eq("week_id", p.weekId)
      .eq("ingredient_key", p.ingredient);
    if (e) return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: t.issueSaved } };
}

/** Retire le signalement (le produit a finalement été trouvé). Les achats ne sont pas touchés. */
export async function clearShoppingIssue(
  weekId: string,
  ingredient: string,
): Promise<ActionResult<{ message: string }>> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household } = await requireHousehold("/app/shopping");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!z.uuid().safeParse(weekId).success || !ingredient) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_issues")
    .delete()
    .eq("household_id", household.id)
    .eq("week_id", weekId)
    .eq("ingredient_key", ingredient);
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: t.issueCleared } };
}

const prepInput = z.object({
  weekId: z.uuid(),
  uid: z.string().min(1).max(64),
  state: z.enum(["started", "prepared"]),
});

/**
 * « Déjà commencé / préparé » (§14) : protège une préparation. Elle ne peut plus être remplacée ni réécrite,
 * et son allocation de ressources est préservée. Il n'y a pas de retour en arrière.
 */
export async function markPreparation(raw: z.infer<typeof prepInput>): Promise<ActionResult<{ message: string }>> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household } = await requireHousehold("/app");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  const parsed = prepInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  const p = parsed.data;
  const ctx = await loadHouseholdContext(household.id);
  const week = ctx.weeks.find((w) => w.id === p.weekId);
  if (!week) return { ok: false, error: fr.menuActions.weekGone };
  const env = await engineEnvFor(ctx);
  const plan = ensureOccurrenceIds(week.plan, () => crypto.randomUUID());
  const known = listOccurrences(env, plan, portionModelFor(ctx, plan.start), ctx.settings.menu.cake.enabled);
  if (!known.some((o) => o.uid === p.uid)) return { ok: false, error: t.prepUnknown };
  const supabase = await createClient();
  // Les identités posées pour la première fois sont enregistrées avec le plan.
  if (JSON.stringify(plan) !== JSON.stringify(week.plan)) {
    const { error: e } = await supabase.from("weeks").update({ plan: plan as unknown as Json }).eq("id", p.weekId);
    if (e) return { ok: false, error: toUserMessage(e) };
  }
  const { data: existing } = await supabase
    .from("preparation_states")
    .select("state")
    .eq("week_id", p.weekId)
    .eq("uid", p.uid)
    .maybeSingle();
  const res = existing
    ? await supabase.from("preparation_states").update({ state: p.state }).eq("week_id", p.weekId).eq("uid", p.uid)
    : await supabase
        .from("preparation_states")
        .insert({ week_id: p.weekId, uid: p.uid, household_id: household.id, state: p.state });
  if (res.error) return { ok: false, error: toUserMessage(res.error) };
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: t.prepMarked } };
}

const coverageInput = z.object({ weekId: z.uuid(), ingredient: z.string().min(1).max(60) });

/**
 * « Confirmer que j'en ai assez » : couverture non numérique, bornée au besoin calculé par le serveur
 * au moment de la confirmation. Une augmentation ultérieure du besoin la rend caduque (AC-12).
 */
export async function confirmCoverage(raw: z.infer<typeof coverageInput>): Promise<ActionResult<{ message: string }>> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household } = await requireHousehold("/app/shopping");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "purchases"))) return { ok: false, error: fr.errors.upgrade };
  const parsed = coverageInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  const p = parsed.data;
  const ctx = await loadHouseholdContext(household.id);
  const week = ctx.weeks.find((w) => w.id === p.weekId);
  if (!week) return { ok: false, error: fr.menuActions.weekGone };
  const env = await engineEnvFor(ctx);
  const shared = pantryForWeek(ctx, env, week);
  // Seul un stock « assez » de cette semaine se confirme ; le besoin vient du plan, jamais du client.
  if (shared.pantry[p.ingredient] !== null || shared.unverified.has(p.ingredient))
    return { ok: false, error: t.notDeclaredAssez };
  const need = shoppingNeeds(env, week.plan, portionModelFor(ctx, week.plan.start), shared.pantry, ctx.settings.menu.cake.enabled)[
    p.ingredient
  ]?.need;
  if (need === undefined) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase
    .from("coverage_confirmations")
    .upsert(
      { week_id: p.weekId, ingredient_key: p.ingredient, household_id: household.id, confirmed_need: need },
      { onConflict: "week_id,ingredient_key" },
    );
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: t.coverageConfirmed } };
}
