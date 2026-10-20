import "server-only";
import { generateWeek, weekRecipeIds } from "@/engine/compose";
import { createEnv, type Env } from "@/engine/env";
import { pantryAfterWeek, totals } from "@/engine/quantities";
import { buildSession } from "@/engine/session";
import type { WeekPlan } from "@/engine/types";
import { isRemoved } from "@/engine/week";
import { addDays, mondayOf, nextMonday, todayIn } from "@/lib/dates";
import { toDietRules, toEquipment, toMenuSettings } from "@/lib/settings";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { loadLibrary } from "./catalog";
import {
  type HouseholdContext,
  loadHouseholdContext,
  portionModelFor,
  type WeekRow,
} from "./household-context";
import { syncShoppingItems } from "./shopping";

export async function engineEnvFor(ctx: HouseholdContext, random: () => number = Math.random): Promise<Env> {
  const { lib, bonus } = await loadLibrary(ctx.id);
  return createEnv({
    lib,
    pantry: ctx.pantry,
    ratings: ctx.ratings,
    random,
    diet: toDietRules(ctx.settings),
    bonus,
    cakeTypes: ctx.settings.menu.cake.types,
  });
}

/** Statut d'une semaine selon la date du jour : brouillon avant le lundi, active jusqu'au dimanche, puis terminée. */
export function statusOn(start: string, today: string): WeekRow["status"] {
  if (today < start) return "draft";
  return today <= addDays(start, 6) ? "active" : "done";
}

/** Semaine en cours (celle qui contient aujourd'hui) et prochaine semaine préparée, s'il y en a. */
export function currentAndNext(ctx: HouseholdContext) {
  const today = todayIn(ctx.timezone);
  const monday = mondayOf(today);
  return {
    today,
    current: ctx.weeks.find((w) => w.start_date === monday) ?? null,
    next: ctx.weeks.find((w) => w.start_date > monday) ?? null,
    nextStart: nextMonday(today),
  };
}

export type WeekSummary = { meals: number; sessionMinutes: number; shoppingItems: number };

/** Récapitulatif d'une semaine : repas prévus du lundi au vendredi, durée de session, articles de courses. */
export async function summarize(ctx: HouseholdContext, plan: WeekPlan, env?: Env): Promise<WeekSummary> {
  const e = env ?? (await engineEnvFor(ctx));
  const pm = portionModelFor(ctx, plan.start);
  const t = totals(e, plan, pm, ctx.settings.menu.cake.enabled);
  const session = buildSession({
    env: e,
    week: plan,
    pm,
    pantry: ctx.pantry,
    totals: t,
    equipment: toEquipment(ctx.settings),
    level: ctx.settings.session.level,
  });
  const slots = [
    ...plan.groups.flatMap((g) => g.meals),
    ...(plan.soup?.days ?? []).map((day) => ({ day, meal: "dinner" as const })),
    ...plan.simples.map((s) => ({ day: s.day, meal: "dinner" as const })),
    ...plan.bank,
  ].filter((m) => !isRemoved(plan, m.day, m.meal));
  const base = new Set(Object.keys(t).filter((k) => e.lib.ingredients[k]?.c === "base"));
  const toBuy = Object.keys(t).filter((k) => !base.has(k) && !(k in ctx.pantry));
  return { meals: slots.length, sessionMinutes: session.total, shoppingItems: toBuy.length };
}

/** Restes de la semaine au garde-manger (« Mettre à jour le garde-manger », §7.4 et §8.4). */
export async function applyLeftovers(ctx: HouseholdContext, env: Env, row: WeekRow) {
  const supabase = await createClient();
  const plan = row.plan;
  const t = totals(env, plan, portionModelFor(ctx, plan.start), ctx.settings.menu.cake.enabled);
  const changes = pantryAfterWeek(env, ctx.pantry, t);
  for (const c of changes) {
    if (c.after > 0) {
      await supabase.from("pantry").upsert({ household_id: ctx.id, ingredient_key: c.k, qty: c.after });
    } else {
      await supabase.from("pantry").delete().eq("household_id", ctx.id).eq("ingredient_key", c.k);
    }
  }
  await supabase.from("weeks").update({ pantry_done: true }).eq("id", row.id);
  return changes;
}

/** Plats doublés de la semaine ajoutés à la réserve du congélateur (une fois par semaine). */
export async function bankDoubles(ctx: HouseholdContext, row: WeekRow) {
  const supabase = await createClient();
  const plan = row.plan;
  if (plan.banked) return 0;
  let total = 0;
  for (const i of plan.doubles ?? []) {
    const g = plan.groups[i];
    if (!g) continue;
    const n = g.meals.filter((m) => !isRemoved(plan, m.day, m.meal)).length;
    if (!n) continue;
    total += n;
    await supabase
      .from("freezer")
      .insert({ household_id: ctx.id, recipe_id: g.id, portions: n, frozen_at: plan.start });
  }
  await supabase
    .from("weeks")
    .update({ plan: { ...plan, banked: true } as unknown as Json })
    .eq("id", row.id);
  return total;
}

/**
 * Clôture d'une semaine passée (`commitWeek` du prototype) : restes au garde-manger si la mise à jour n'a
 * pas été faite, repas pris dans la réserve décomptés, plats doublés ajoutés au congélateur.
 */
async function commitWeek(ctx: HouseholdContext, env: Env, row: WeekRow) {
  const supabase = await createClient();
  const plan = row.plan;
  if (!row.pantry_done) await applyLeftovers(ctx, env, row);
  if (!plan.bankConsumed) {
    for (const slot of plan.bank ?? []) {
      if (isRemoved(plan, slot.day, slot.meal)) continue;
      const { data } = await supabase
        .from("freezer")
        .select("id, portions")
        .eq("household_id", ctx.id)
        .eq("recipe_id", slot.id)
        .gt("portions", 0)
        .order("frozen_at")
        .limit(1)
        .maybeSingle();
      if (!data) continue;
      if (data.portions <= 1) await supabase.from("freezer").delete().eq("id", data.id);
      else
        await supabase
          .from("freezer")
          .update({ portions: data.portions - 1 })
          .eq("id", data.id);
    }
  }
  await bankDoubles(ctx, row);
  await supabase
    .from("weeks")
    .update({ pantry_done: true, plan: { ...plan, banked: true, bankConsumed: true } as unknown as Json })
    .eq("id", row.id);
}

export type GenerateOutcome =
  | { ok: true; week: WeekPlan; weekId: string; summary: WeekSummary; dislikesIgnored: boolean }
  | { ok: false; reason: "impossible" | "forbidden" };

/**
 * Génère et enregistre la semaine qui commence `start` (en brouillon), en remplaçant un plan existant
 * pour cette date. Clôture d'abord la semaine précédente si elle ne l'est pas encore.
 */
export async function generateAndStore(householdId: string, start: string): Promise<GenerateOutcome> {
  const supabase = await createClient();
  let ctx = await loadHouseholdContext(householdId);
  const env = await engineEnvFor(ctx);

  const previousRow = ctx.weeks.find((w) => w.start_date < start) ?? null;
  if (previousRow && !(previousRow.pantry_done && previousRow.plan.banked && previousRow.plan.bankConsumed)) {
    await commitWeek(ctx, env, previousRow);
    ctx = { ...ctx, ...(await reloadStock(householdId)) };
  }

  const existing = ctx.weeks.find((w) => w.start_date === start) ?? null;
  const history = ctx.weeks.filter((w) => w.start_date < start).map((w) => weekRecipeIds(w.plan));
  const freshEnv = createEnv({
    lib: env.lib,
    pantry: ctx.pantry,
    ratings: ctx.ratings,
    random: Math.random,
    diet: toDietRules(ctx.settings),
    bonus: env.bonus,
    cakeTypes: ctx.settings.menu.cake.types,
  });
  const res = generateWeek({
    env: freshEnv,
    settings: toMenuSettings(ctx.settings),
    start,
    previous: previousRow?.plan ?? null,
    bank: ctx.bank,
    history,
  });
  if (!res.ok) return { ok: false, reason: "impossible" };

  // Le week-end déjà choisi pour cette semaine est gardé (comme le prototype).
  const plan: WeekPlan = existing?.plan.weekend ? { ...res.week, weekend: existing.plan.weekend } : res.week;
  const today = todayIn(ctx.timezone);
  const payload = {
    household_id: householdId,
    start_date: start,
    status: statusOn(start, today),
    plan: plan as unknown as Json,
    pasta_need: plan.pastaNeed,
    pantry_done: false,
  };
  const { data, error } = existing
    ? await supabase
        .from("weeks")
        .update({
          status: payload.status,
          plan: payload.plan,
          pasta_need: payload.pasta_need,
          pantry_done: false,
        })
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase.from("weeks").insert(payload).select("id").single();
  if (error) return { ok: false, reason: error.code === "42501" ? "forbidden" : "impossible" };
  await syncShoppingItems(ctx, freshEnv, { id: data.id, plan });
  const summary = await summarize(ctx, plan, freshEnv);
  return { ok: true, week: plan, weekId: data.id, summary, dislikesIgnored: res.dislikesIgnored };
}

/** Relit le garde-manger et le congélateur après une clôture de semaine. */
async function reloadStock(householdId: string) {
  const supabase = await createClient();
  const [pantry, freezer] = await Promise.all([
    supabase.from("pantry").select("ingredient_key, qty").eq("household_id", householdId),
    supabase
      .from("freezer")
      .select("recipe_id, portions, frozen_at")
      .eq("household_id", householdId)
      .order("frozen_at"),
  ]);
  return {
    pantry: Object.fromEntries(
      (pantry.data ?? []).map((p) => [p.ingredient_key, p.qty === null ? null : Number(p.qty)]),
    ),
    bank: (freezer.data ?? []).map((f) => ({
      recipeId: f.recipe_id,
      portions: f.portions,
      frozenAt: f.frozen_at,
    })),
  };
}
