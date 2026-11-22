import "server-only";
import { effectiveLevel } from "@/engine/first-session";
import { snapshotPortions, type FrozenWeek } from "@/engine/frozen";
import { totals } from "@/engine/quantities";
import { buildSession } from "@/engine/session";
import { toEquipment } from "@/lib/settings";
import { firstSessionInfo, isFirstSessionFor } from "@/server/getting-started";
import { type HouseholdContext, portionModelFor, type WeekRow } from "@/server/household-context";
import { engineEnvFor } from "@/server/weeks";

/**
 * Étapes de la session d'une semaine. Une semaine figée garde les étapes enregistrées au lancement ;
 * sinon elles sont recalculées depuis le menu, les portions, le garde-manger et l'équipement du moment.
 */
export async function weekSession(ctx: HouseholdContext, week: WeekRow) {
  const first = await firstSessionInfo(ctx.id);
  const firstWeek = isFirstSessionFor(first, week.id);
  // Première session du foyer : « débutant » par défaut, modifiable (SPEC_PRISE_EN_MAIN §4.4.3).
  const level = effectiveLevel({
    firstSession: firstWeek,
    override: first.override,
    setting: ctx.settings.session.level,
  });
  if (week.frozen) {
    return { first, firstWeek, level, steps: week.frozen.steps, total: week.frozen.total };
  }
  const env = await engineEnvFor(ctx);
  const pm = portionModelFor(ctx, week.plan.start);
  const t = totals(env, week.plan, pm, ctx.settings.menu.cake.enabled);
  const session = buildSession({
    env,
    week: { ...week.plan, pantryDone: week.pantry_done },
    pm,
    pantry: ctx.pantry,
    totals: t,
    equipment: toEquipment(ctx.settings),
    level,
  });
  return { first, firstWeek, level, steps: session.steps, total: session.total };
}

/** Instantané enregistré au lancement de la session : portions et étapes de ce moment-là. */
export async function freezeSnapshot(ctx: HouseholdContext, week: WeekRow): Promise<FrozenWeek> {
  const { steps, total } = await weekSession(ctx, week);
  return {
    at: new Date().toISOString(),
    portions: snapshotPortions(portionModelFor(ctx, week.plan.start)),
    steps,
    total,
  };
}
