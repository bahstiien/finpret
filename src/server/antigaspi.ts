import "server-only";
import { type Impact, impactOf, pantrySaves } from "@/engine/antigaspi";
import { totals } from "@/engine/quantities";
import { todayIn } from "@/lib/dates";
import { withAdmin } from "@/server/db";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { withSession } from "@/server/session";
import { engineEnvFor } from "@/server/weeks";
import { loadLibrary } from "@/server/catalog";

/** Anti-gaspi : ingrédients pris dans le stock par une session terminée, et leur somme pour l'écran Progrès. */

/**
 * Inscrit les ingrédients que la semaine prend dans le garde-manger (avant la mise à jour des restes).
 * La semaine doit déjà avoir été vérifiée comme appartenant au foyer. Une seule inscription par semaine.
 */
export async function recordPantrySaves(householdId: string, weekId: string): Promise<void> {
  const ctx = await loadHouseholdContext(householdId);
  const week = ctx.weeks.find((w) => w.id === weekId);
  if (!week) return;
  const env = await engineEnvFor(ctx);
  const today = todayIn(ctx.timezone);
  const t = totals(env, week.plan, portionModelFor(ctx, week.plan.start), ctx.settings.menu.cake.enabled);
  const saves = pantrySaves(env.lib, ctx.pantry, ctx.useBy, t, today);
  if (saves.length === 0) return;
  await withAdmin((db) =>
    db
      .insertInto("pantry_saves")
      .values(
        saves.map((s) => ({
          household_id: householdId,
          week_id: weekId,
          ingredient_key: s.k,
          qty: s.qty,
          urgent: s.urgent,
          saved_on: today,
        })),
      )
      .onConflict((oc) => oc.columns(["household_id", "week_id", "ingredient_key"]).doNothing())
      .execute(),
  );
}

export type AntigaspiImpact = { month: Impact; total: Impact };

/** Impact du mois en cours et depuis le début. */
export async function loadAntigaspiImpact(householdId: string, timezone: string): Promise<AntigaspiImpact> {
  const [rows, { lib }] = await Promise.all([
    withSession((db) =>
      db
        .selectFrom("pantry_saves")
        .select(["ingredient_key", "qty", "urgent", "saved_on"])
        .where("household_id", "=", householdId)
        .execute(),
    ),
    loadLibrary(householdId),
  ]);
  const saves = rows.map((r) => ({
    k: r.ingredient_key,
    qty: r.qty === null ? null : Number(r.qty),
    urgent: r.urgent,
    on: r.saved_on,
  }));
  const month = todayIn(timezone).slice(0, 7);
  return {
    month: impactOf(lib, saves.filter((s) => s.on.startsWith(month))),
    total: impactOf(lib, saves),
  };
}
