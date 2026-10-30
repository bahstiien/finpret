"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toCatalogUnit } from "@/engine/purchases";
import { ensureOccurrenceIds, listOccurrences } from "@/engine/occurrences";
import { shoppingNeeds } from "@/engine/shopping";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { json, rpc } from "@/server/db";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { householdCan } from "@/server/entitlements-load";
import { pantryForWeek } from "@/server/allocations";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { trackEvent } from "@/server/events";
import { allow } from "@/server/rate-limit";
import { requireHousehold, withSession } from "@/server/session";
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

  // Idempotence, révision et solde sont vérifiés dans la transaction SQL, sous verrou de la semaine.
  let res: { replayed: boolean; revision: number };
  try {
    res = await withSession((db) =>
      rpc<{ replayed: boolean; revision: number }>(db, "record_purchase", {
        p_week: p.weekId,
        p_ingredient: p.ingredient,
        p_qty: q.value,
        p_type: type,
        p_op_key: p.opKey,
        p_expected_revision: p.expectedRevision ?? null,
      }),
    );
  } catch (e) {
    return { ok: false, error: purchaseError(e as { code?: string; message?: string }) };
  }
  if (!res.replayed) {
    await trackEvent(type === "purchase" ? "purchase_recorded" : "purchase_quantity_corrected", {
      userId: user.id,
      householdId: household.id,
      props: { op: p.opKey },
    });
    revalidatePath("/app", "layout");
  }
  return { ok: true, data: { message: res.replayed ? t.replayed : okMessage, revision: res.revision } };
}

/** Erreurs métier levées par les fonctions SQL d'achats, traduites pour l'utilisateur. */
function purchaseError(e: { code?: string; message?: string }): string {
  const known: Record<string, string> = {
    version_conflict: t.VERSION_CONFLICT,
    idempotency_conflict: t.IDEMPOTENCY_CONFLICT,
    insufficient_available_quantity: t.INSUFFICIENT_AVAILABLE_QUANTITY,
    invalid_quantity: t.INVALID_QUANTITY,
  };
  const hit = Object.entries(known).find(([code]) => e.message === code);
  if (hit) return hit[1];
  return e.code === "42501" ? fr.errors.forbidden : t.failed;
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
  const { household, user } = await requireHousehold("/app/shopping");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "purchases"))) return { ok: false, error: fr.errors.upgrade };
  const parsed = issueInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: t.INVALID_QUANTITY };
  const p = parsed.data;
  if (!allow(`issue:${household.id}`, 60, 60_000)) return { ok: false, error: fr.errors.generic };
  try {
    await withSession(async (db) => {
      const existing = await db
        .selectFrom("shopping_issues")
        .select("id")
        .where("week_id", "=", p.weekId)
        .where("ingredient_key", "=", p.ingredient)
        .executeTakeFirst();
      if (!existing) {
        await db
          .insertInto("shopping_issues")
          .values({ household_id: household.id, week_id: p.weekId, ingredient_key: p.ingredient })
          .execute();
      }
      // La décision par défaut est « à résoudre » ; tout autre choix passe par une mise à jour.
      if (existing || p.decision !== "open") {
        await db
          .updateTable("shopping_issues")
          .set({ decision: p.decision })
          .where("week_id", "=", p.weekId)
          .where("ingredient_key", "=", p.ingredient)
          .execute();
      }
    });
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  await trackEvent("shopping_issue_reported", {
    userId: user.id,
    householdId: household.id,
    props: { decision: p.decision },
  });
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
  try {
    await withSession((db) =>
      db
        .deleteFrom("shopping_issues")
        .where("household_id", "=", household.id)
        .where("week_id", "=", weekId)
        .where("ingredient_key", "=", ingredient)
        .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
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
export async function markPreparation(
  raw: z.infer<typeof prepInput>,
): Promise<ActionResult<{ message: string }>> {
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
  const pm = portionModelFor(ctx, plan.start);
  const cakeOn = ctx.settings.menu.cake.enabled;
  const before = listOccurrences(env, week.plan, pm, cakeOn);
  const known = listOccurrences(env, plan, pm, cakeOn);
  // Une semaine sans identités persistées expose des identités dérivées (« main:0 ») : même ordre, même préparation.
  const at = before.findIndex((o) => o.uid === p.uid);
  const uid = at >= 0 ? known[at]?.uid : known.find((o) => o.uid === p.uid)?.uid;
  if (!uid) return { ok: false, error: t.prepUnknown };
  p.uid = uid;
  try {
    await withSession(async (db) => {
      // Les identités posées pour la première fois sont enregistrées avec le plan.
      if (JSON.stringify(plan) !== JSON.stringify(week.plan)) {
        await db
          .updateTable("weeks")
          .set({ plan: json(plan) })
          .where("id", "=", p.weekId)
          .execute();
      }
      const existing = await db
        .selectFrom("preparation_states")
        .select("state")
        .where("week_id", "=", p.weekId)
        .where("uid", "=", p.uid)
        .executeTakeFirst();
      if (existing)
        await db
          .updateTable("preparation_states")
          .set({ state: p.state })
          .where("week_id", "=", p.weekId)
          .where("uid", "=", p.uid)
          .execute();
      else
        await db
          .insertInto("preparation_states")
          .values({ week_id: p.weekId, uid: p.uid, household_id: household.id, state: p.state })
          .execute();
    });
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: t.prepMarked } };
}

const coverageInput = z.object({ weekId: z.uuid(), ingredient: z.string().min(1).max(60) });

/**
 * « Confirmer que j'en ai assez » : couverture non numérique, bornée au besoin calculé par le serveur
 * au moment de la confirmation. Une augmentation ultérieure du besoin la rend caduque (AC-12).
 */
export async function confirmCoverage(
  raw: z.infer<typeof coverageInput>,
): Promise<ActionResult<{ message: string }>> {
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
  const need = shoppingNeeds(
    env,
    week.plan,
    portionModelFor(ctx, week.plan.start),
    shared.pantry,
    ctx.settings.menu.cake.enabled,
  )[p.ingredient]?.need;
  if (need === undefined) return { ok: false, error: fr.errors.generic };
  try {
    await withSession((db) =>
      db
        .insertInto("coverage_confirmations")
        .values({
          week_id: p.weekId,
          ingredient_key: p.ingredient,
          household_id: household.id,
          confirmed_need: need,
        })
        .onConflict((oc) =>
          oc
            .columns(["week_id", "ingredient_key"])
            .doUpdateSet({ household_id: household.id, confirmed_need: need }),
        )
        .execute(),
    );
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/app", "layout");
  return { ok: true, data: { message: t.coverageConfirmed } };
}

const transferInput = z.object({
  fromWeekId: z.uuid(),
  toWeekId: z.uuid(),
  ingredient: z.string().min(1).max(60),
  qty: z.number().finite().positive().max(100000),
  unit: z.enum(["g", "kg", "ml", "l", "pc", "boite", "cs", "cc"]),
  opKey: z.string().min(8).max(120),
});

/**
 * « Réaffecter » : transfert explicite d'une quantité disponible vers une autre semaine. La source diminue de
 * la même quantité, la destination l'acquiert : aucune seconde copie (§9.6).
 */
export async function transferPurchase(
  raw: z.infer<typeof transferInput>,
): Promise<ActionResult<{ message: string }>> {
  if (!FEATURES.realPurchases) return { ok: false, error: fr.errors.forbidden };
  const { household } = await requireHousehold("/app/shopping");
  if (household.role === "viewer") return { ok: false, error: fr.errors.forbidden };
  if (!(await householdCan(household.id, "purchases"))) return { ok: false, error: fr.errors.upgrade };
  const parsed = transferInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: t.INVALID_QUANTITY };
  const p = parsed.data;
  if (!allow(`purchase:${household.id}`, 60, 60_000)) return { ok: false, error: fr.errors.generic };
  const ctx = await loadHouseholdContext(household.id);
  if (!ctx.weeks.some((w) => w.id === p.fromWeekId) || !ctx.weeks.some((w) => w.id === p.toWeekId))
    return { ok: false, error: fr.menuActions.weekGone };
  const { lib } = await engineEnvFor(ctx);
  const q = toCatalogUnit(lib, p.ingredient, p.qty, p.unit);
  if (!q.ok) return { ok: false, error: t[q.code] };
  let replayed: boolean;
  try {
    const data = await withSession((db) =>
      rpc<{ replayed: boolean }>(db, "transfer_purchase", {
        p_from: p.fromWeekId,
        p_to: p.toWeekId,
        p_ingredient: p.ingredient,
        p_qty: q.value,
        p_op_key: p.opKey,
      }),
    );
    replayed = data.replayed;
  } catch (e) {
    return { ok: false, error: purchaseError(e as { code?: string; message?: string }) };
  }
  if (!replayed) revalidatePath("/app", "layout");
  return { ok: true, data: { message: replayed ? t.replayed : t.transferred } };
}

/**
 * « Vérifier mes courses » ouvert : indicateur du bilan (nombre de lignes à résoudre seulement, jamais de
 * libellé). Ne modifie aucune donnée.
 */
export async function trackReviewCompleted(unresolved: number): Promise<void> {
  if (!FEATURES.realPurchases || !Number.isInteger(unresolved) || unresolved < 0 || unresolved > 1000) return;
  const { household, user } = await requireHousehold("/app/shopping");
  await trackEvent("shopping_review_completed", {
    userId: user.id,
    householdId: household.id,
    props: { unresolved },
  });
}
