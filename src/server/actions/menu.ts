"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  moveSlot,
  moveTargets,
  setGuests,
  setWeekend,
  suggestWeekend,
  swap,
  toggleDouble,
  toggleMeal,
} from "@/engine/edit";
import type { Env } from "@/engine/env";
import { changedOccurrences, ensureOccurrenceIds, listOccurrences } from "@/engine/occurrences";
import type { WeekPlan } from "@/engine/types";
import { slotMap } from "@/engine/week";
import { fr } from "@/i18n/fr";
import { todayIn } from "@/lib/dates";
import { FEATURES } from "@/lib/features";
import { toMenuSettings } from "@/lib/settings";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { Feature } from "@/server/entitlements";
import { loadOffer, swapsUsed } from "@/server/entitlements-load";
import { can } from "@/server/entitlements";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { trackEvent } from "@/server/events";
import { lockedFor, loadLockState } from "@/server/allocations";
import { type HouseholdContext, loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { requireHousehold } from "@/server/session";
import { syncShoppingItems } from "@/server/shopping";
import { engineEnvFor, generateAndStore } from "@/server/weeks";

/**
 * Actions de l'écran Menu (§8.1, §8.7). Chacune relit la semaine, applique le moteur et enregistre le plan.
 * Le message renvoyé s'affiche dans un toast.
 */

const t = fr.menuActions;
const uuid = z.uuid();
const slotKey = z.string().regex(/^[1-7]-(lunch|dinner)$/);
const meal = z.enum(["lunch", "dinner"]);
const day = z.number().int().min(1).max(7);

type Edit = (input: {
  env: Env;
  plan: WeekPlan;
  ctx: HouseholdContext;
}) =>
  | { plan: WeekPlan; message: string }
  | { error: string }
  | Promise<{ plan: WeekPlan; message: string } | { error: string }>;

async function editWeek(
  weekId: string,
  edit: Edit,
  feature?: Feature,
): Promise<ActionResult<{ message: string }>> {
  const { user, household } = await requireHousehold("/app");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!uuid.safeParse(weekId).success) return { ok: false, error: fr.errors.generic };
  // Offre gratuite ou payante (SPEC_JANVIER §4) : décidée côté serveur.
  if (feature) {
    const used = feature === "menu.swap" ? await swapsUsed(household.id, weekId) : 0;
    if (!can(await loadOffer(household.id), feature, { used }))
      return { ok: false, error: fr.errors.upgrade };
  }
  const ctx = await loadHouseholdContext(household.id);
  const row = ctx.weeks.find((w) => w.id === weekId);
  if (!row) return { ok: false, error: t.weekGone };
  const env = await engineEnvFor(ctx);
  // Préparations à identité stable : posées avant toute modification (courses réelles, lot L2).
  const basePlan = FEATURES.realPurchases ? ensureOccurrenceIds(row.plan, () => crypto.randomUUID()) : row.plan;
  const res = await edit({ env, plan: basePlan, ctx });
  if ("error" in res) return { ok: false, error: res.error };
  if (FEATURES.realPurchases) {
    // Une préparation commencée ou préparée ne change pas, quel que soit l'écran d'où vient la modification (AC-10).
    const pm = portionModelFor(ctx, basePlan.start);
    const cakeOn = ctx.settings.menu.cake.enabled;
    const before = listOccurrences(env, basePlan, pm, cakeOn);
    const touched = changedOccurrences(before, listOccurrences(env, res.plan, pm, cakeOn));
    const locked = lockedFor(before, await loadLockState(weekId));
    if (touched.some((uid) => locked.has(uid))) return { ok: false, error: t.locked };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("weeks")
    .update({ plan: res.plan as unknown as Json, pasta_need: res.plan.pastaNeed })
    .eq("id", weekId);
  if (error) return { ok: false, error: toUserMessage(error) };
  await syncShoppingItems(ctx, env, { id: weekId, plan: res.plan });
  if (feature === "menu.swap") {
    await trackEvent("menu_swap", { userId: user.id, householdId: household.id, props: { week: weekId } });
  }
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: res.message } };
}

const nameOf = (env: Env, id: string) =>
  (env.mainById.get(id) ?? env.soupById.get(id) ?? env.simpleById.get(id) ?? env.cakeById.get(id))?.n ?? id;
const shortOf = (env: Env, id: string) =>
  (env.mainById.get(id) ?? env.soupById.get(id) ?? env.simpleById.get(id))?.s ?? nameOf(env, id);
const slotLabel = (k: string) => {
  const [d, m] = k.split("-") as [string, "lunch" | "dinner"];
  return `${fr.days[Number(d) - 1]} ${fr.meals[m].toLowerCase()}`;
};

type SwapKind = "main" | "soup" | "simple" | "bank";

async function swapWith(weekId: string, kind: SwapKind, index: number, feature?: Feature) {
  if (!["main", "soup", "simple", "bank"].includes(kind) || !Number.isInteger(index)) {
    return { ok: false as const, error: fr.errors.generic };
  }
  return editWeek(
    weekId,
    ({ env, plan, ctx }) => {
      const res = swap(env, plan, toMenuSettings(ctx.settings), kind, index, ctx.bank);
      if (!res.ok) return { error: t.swapFailed[res.reason] };
      return {
        plan: res.week,
        message: t.replaced(
          shortOf(env, res.replaced),
          res.added.map((id) => shortOf(env, id).toLowerCase()),
        ),
      };
    },
    feature,
  );
}

/** « Changer » un plat, la soupe, un soir simple ou un repas de la réserve. */
export async function swapDish(weekId: string, kind: SwapKind, index: number) {
  return swapWith(weekId, kind, index, "menu.swap");
}

/** « Retirer » ou « Remettre » un repas. */
export async function toggleMealAction(weekId: string, d: number, m: "lunch" | "dinner") {
  if (!day.safeParse(d).success || !meal.safeParse(m).success)
    return { ok: false as const, error: fr.errors.generic };
  return editWeek(weekId, ({ plan }) => {
    const next = toggleMeal(plan, d, m);
    const removed = next.removed.includes(`${d}-${m}`);
    return { plan: next, message: removed ? t.removed : t.restored };
  });
}

/** « Déplacer » : échange deux créneaux. */
export async function moveAction(weekId: string, from: string, to: string) {
  if (!slotKey.safeParse(from).success || !slotKey.safeParse(to).success) {
    return { ok: false as const, error: fr.errors.generic };
  }
  return editWeek(
    weekId,
    ({ env, plan }) => {
      const res = moveSlot(env, plan, from, to);
      if (!res.ok) return { error: t.moveFailed[res.reason] };
      const warn = res.warnings.tooLate ? ` ${t.tooLate(shortOf(env, res.warnings.tooLate))}` : "";
      return { plan: res.week, message: t.moved(slotLabel(from), slotLabel(to)) + warn };
    },
    "menu.move",
  );
}

/** Créneaux proposés dans la feuille « Déplacer » (même période ; ceux qui créent un conflit de pâtes sont refusés). */
export async function moveTargetsAction(weekId: string, from: string) {
  const { household } = await requireHousehold("/app");
  if (!slotKey.safeParse(from).success) return { ok: false as const, error: fr.errors.generic };
  const ctx = await loadHouseholdContext(household.id);
  const row = ctx.weeks.find((w) => w.id === weekId);
  if (!row) return { ok: false as const, error: t.weekGone };
  const env = await engineEnvFor(ctx);
  const targets = moveTargets(env, row.plan, from).map((x) => ({
    key: x.key,
    ok: x.ok,
    reason: x.reason ? t.moveFailed[x.reason] : null,
    warning: x.warnings?.tooLate ? t.tooLate(shortOf(env, x.warnings.tooLate)) : null,
  }));
  return { ok: true as const, data: { targets } };
}

const guestsSchema = z
  .object({ a: z.number().int().min(0).max(20), c: z.number().int().min(0).max(20) })
  .nullable();

/** « Qui est à table ? » */
export async function setGuestsAction(weekId: string, d: number, m: "lunch" | "dinner", guests: unknown) {
  const parsed = guestsSchema.safeParse(guests);
  if (!day.safeParse(d).success || !meal.safeParse(m).success || !parsed.success) {
    return { ok: false as const, error: fr.errors.generic };
  }
  return editWeek(
    weekId,
    ({ plan }) => ({
      plan: setGuests(plan, d, m, parsed.data),
      message: t.guestsSaved,
    }),
    "menu.guests",
  );
}

/** « Doubler » un plat pour la réserve du congélateur. */
export async function toggleDoubleAction(weekId: string, index: number) {
  if (!Number.isInteger(index)) return { ok: false as const, error: fr.errors.generic };
  return editWeek(weekId, ({ env, plan }) => {
    const next = toggleDouble(env, plan, index);
    const id = plan.groups[index]?.id ?? "";
    return { plan: next, message: next.doubles.includes(index) ? t.doubled(shortOf(env, id)) : t.undoubled };
  });
}

/** Suggérer des idées pour les créneaux vides du week-end. */
export async function suggestWeekendAction(weekId: string) {
  return editWeek(weekId, ({ env, plan }) => {
    const res = suggestWeekend(env, plan);
    return { plan: res.week, message: res.added ? t.weekendSuggested(res.added) : t.weekendFull };
  });
}

/** Choisir (ou retirer) la recette d'un créneau du week-end. */
export async function setWeekendAction(weekId: string, key: string, recipeId: string | null) {
  if (!/^[67]-(lunch|dinner)$/.test(key)) return { ok: false as const, error: fr.errors.generic };
  return editWeek(weekId, ({ env, plan }) => {
    if (
      recipeId &&
      !(env.mainById.has(recipeId) || env.soupById.has(recipeId) || env.simpleById.has(recipeId))
    ) {
      return { error: t.unknownRecipe };
    }
    const res = setWeekend(env, plan, key, recipeId);
    const message = recipeId
      ? t.weekendSet(shortOf(env, recipeId), slotLabel(key)) + (res.pastaClash ? ` ${t.pastaWarning}` : "")
      : t.weekendCleared(slotLabel(key));
    return { plan: res.week, message };
  });
}

/** Changer le goûter de la semaine. */
export async function setCakeAction(weekId: string, cakeId: string) {
  return editWeek(weekId, ({ env, plan }) => {
    if (!env.cakeById.has(cakeId)) return { error: t.unknownRecipe };
    return { plan: { ...plan, cake: cakeId }, message: t.cakeSet(nameOf(env, cakeId)) };
  });
}

/**
 * Case de la grille « Repas à prévoir » en semaine (`toggleSlot` du prototype) : le choix est gardé pour les
 * semaines suivantes ; un créneau absent du plan recompose la semaine si elle n'a pas commencé.
 */
export async function toggleGridSlot(weekId: string, d: number, m: "lunch" | "dinner") {
  if (!day.safeParse(d).success || d > 5 || !meal.safeParse(m).success) {
    return { ok: false as const, error: fr.errors.generic };
  }
  const { household } = await requireHousehold("/app");
  if (household.role === "viewer") return { ok: false as const, error: fr.errors.forbidden };
  const ctx = await loadHouseholdContext(household.id);
  const row = ctx.weeks.find((w) => w.id === weekId);
  if (!row) return { ok: false as const, error: t.weekGone };
  const env = await engineEnvFor(ctx);
  const k = `${d}-${m}`;
  const inWeek = !!slotMap(env, row.plan)[k];
  const on = inWeek && !row.plan.removed.includes(k);
  const supabase = await createClient();
  // Structure mémorisée pour les semaines suivantes (réglage du foyer, modifiable par l'administrateur).
  if (household.role === "admin") {
    const skip = on
      ? [...new Set([...ctx.settings.menu.skip, k])]
      : ctx.settings.menu.skip.filter((x) => x !== k);
    await supabase
      .from("household_settings")
      .update({ menu: { ...ctx.settings.menu, skip } as unknown as Json })
      .eq("household_id", household.id);
  }
  if (on || inWeek) {
    const plan = on
      ? { ...row.plan, removed: [...new Set([...row.plan.removed, k])] }
      : { ...row.plan, removed: row.plan.removed.filter((x) => x !== k) };
    const { error } = await supabase
      .from("weeks")
      .update({ plan: plan as unknown as Json })
      .eq("id", weekId);
    if (error) return { ok: false as const, error: toUserMessage(error) };
    revalidatePath("/app", "layout");
    return { ok: true as const, data: { message: on ? t.slotOff(slotLabel(k)) : t.slotOn(slotLabel(k)) } };
  }
  if (row.start_date <= todayIn(ctx.timezone)) return { ok: false as const, error: t.weekStarted };
  const res = await generateAndStore(household.id, row.start_date);
  if (!res.ok && res.reason === "locked") return { ok: false as const, error: t.locked };
  if (!res.ok) return { ok: false as const, error: fr.menu.impossible };
  revalidatePath("/app", "layout");
  return { ok: true as const, data: { message: t.regenerated(slotLabel(k)) } };
}

/** 👍 / 👎 : un refus remplace le plat s'il est dans la semaine. */
export async function rateAction(weekId: string | null, recipeId: string, value: 1 | -1) {
  const { household } = await requireHousehold("/app");
  if (household.role === "viewer") return { ok: false as const, error: fr.errors.forbidden };
  if (![1, -1].includes(value) || !recipeId) return { ok: false as const, error: fr.errors.generic };
  const ctx = await loadHouseholdContext(household.id);
  const supabase = await createClient();
  const current = ctx.ratings[recipeId];
  const { error } =
    current === value
      ? await supabase.from("ratings").delete().eq("household_id", household.id).eq("recipe_id", recipeId)
      : await supabase.from("ratings").upsert({ household_id: household.id, recipe_id: recipeId, value });
  if (error) return { ok: false as const, error: toUserMessage(error) };
  revalidatePath("/app", "layout");
  if (current === value) return { ok: true as const, data: { message: t.ratingCleared } };
  if (value === 1) return { ok: true as const, data: { message: t.liked } };

  const row = weekId ? ctx.weeks.find((w) => w.id === weekId) : null;
  if (!row) return { ok: true as const, data: { message: t.disliked } };
  const p = row.plan;
  const gi = p.groups.findIndex((g) => g.id === recipeId);
  const si = p.simples.findIndex((s) => s.id === recipeId);
  const target: ["main" | "soup" | "simple", number] | null =
    gi >= 0 ? ["main", gi] : p.soup?.id === recipeId ? ["soup", 0] : si >= 0 ? ["simple", si] : null;
  if (!target) return { ok: true as const, data: { message: t.disliked } };
  // Le refus est enregistré : la recherche d'un remplaçant l'exclut désormais.
  const res = await swapWith(row.id, target[0], target[1]);
  return res.ok
    ? { ok: true as const, data: { message: t.dislikedReplaced } }
    : { ok: true as const, data: { message: t.dislikedNoReplacement } };
}

/** « Préparer la semaine suivante » (dès le jeudi) ou « Générer un nouveau menu ». */
export async function prepareWeekAction(start: string) {
  const { household } = await requireHousehold("/app");
  if (household.role === "viewer") return { ok: false as const, error: fr.errors.forbidden };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { ok: false as const, error: fr.errors.generic };
  const res = await generateAndStore(household.id, start);
  if (!res.ok && res.reason === "locked") return { ok: false as const, error: t.locked };
  if (!res.ok) return { ok: false as const, error: fr.menu.impossible };
  revalidatePath("/app", "layout");
  return {
    ok: true as const,
    data: { message: res.dislikesIgnored ? t.generatedWithDislikes : t.generated },
  };
}
