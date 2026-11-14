import "server-only";
import { packaging } from "@/engine/first-session";
import { dur } from "@/engine/format";
import { fr } from "@/i18n/fr";
import { todayIn } from "@/lib/dates";
import { withAdmin } from "./db";
import { loadHouseholdContext, portionModelFor } from "./household-context";
import { buildMenuView } from "./menu-view";
import { engineEnvFor } from "./weeks";

export type FirstRecap = {
  meals: number;
  /** Durée réelle (« 3 h 25 »), omise si inconnue ou supérieure à 12 h. */
  duration: string | null;
  /** Consigne du lundi soir, ou du prochain dîner prévu à défaut. */
  consigne: { monday: boolean; day: string; text: string } | null;
};

/**
 * Cette semaine porte-t-elle la première session terminée du foyer ? Idempotent : stable à chaque appel.
 * On regarde le plus ancien événement `session_done` : deux appels simultanés peuvent en inscrire deux pour la même
 * semaine (vérifier puis insérer n'est pas atomique), ce qui ne doit pas faire perdre le récapitulatif.
 */
export async function isFirstSessionWeek(householdId: string, weekId: string): Promise<boolean> {
  const { row, first } = await withAdmin(async (db) => {
    const row = await db
      .selectFrom("onboarding_progress")
      .select("household_id")
      .where("household_id", "=", householdId)
      .executeTakeFirst();
    const first = await db
      .selectFrom("events")
      .select("props")
      .where("household_id", "=", householdId)
      .where("name", "=", "session_done")
      .orderBy("created_at", "asc")
      .limit(1)
      .executeTakeFirst();
    return { row, first };
  });
  const key = (first?.props as { key?: string } | null)?.key;
  return !!row && key === weekId;
}

/** Récapitulatif de fin de première session (SPEC_PRISE_EN_MAIN §4.4.5). */
export async function loadFirstRecap(householdId: string, weekId: string): Promise<FirstRecap | null> {
  const ctx = await loadHouseholdContext(householdId);
  const row = ctx.weeks.find((w) => w.id === weekId);
  if (!row) return null;
  const env = await engineEnvFor(ctx);
  const pm = portionModelFor(ctx, row.start_date);
  const meals = packaging(env, row.plan, pm).boxes.length;

  // Semaine déjà vérifiée comme appartenant au foyer (ctx.weeks).
  const session = await withAdmin((db) =>
    db.selectFrom("sessions").select(["started_at", "done_at"]).where("week_id", "=", weekId).executeTakeFirst(),
  );
  let duration: string | null = null;
  if (session?.started_at && session.done_at) {
    const minutes = Math.round((Date.parse(session.done_at) - Date.parse(session.started_at)) / 60_000);
    if (minutes > 0 && minutes <= 12 * 60) duration = dur(minutes);
  }

  // Lundi soir d'abord ; s'il est retiré ou absent, le prochain dîner prévu.
  const view = buildMenuView(ctx, env, row, pm, todayIn(ctx.timezone));
  const dinners = view.days
    .filter((d) => d.day <= 5)
    .flatMap((d) => d.meals.filter((m) => m.meal === "dinner" && !m.removed));
  const pick = dinners.find((m) => m.day === 1) ?? dinners[0];
  return {
    meals,
    duration,
    consigne: pick ? { monday: pick.day === 1, day: fr.days[pick.day - 1]!, text: pick.how } : null,
  };
}
