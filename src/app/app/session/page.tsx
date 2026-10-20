import type { Metadata } from "next";
import { SessionScreen } from "@/components/session/SessionScreen";
import { Card } from "@/components/ui/Card";
import { totals } from "@/engine/quantities";
import { buildSession } from "@/engine/session";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { toEquipment } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { requireHousehold } from "@/server/session";
import { currentAndNext, engineEnvFor } from "@/server/weeks";

export const metadata: Metadata = { title: fr.nav.session };

/** Onglet Session (§8.5) : la session de la semaine préparée (ou en cours), étape par étape. */
export default async function SessionPage() {
  const { household } = await requireHousehold("/app/session");
  const ctx = await loadHouseholdContext(household.id);
  const { current, next } = currentAndNext(ctx);
  const week = next ?? current;
  if (!week) {
    return (
      <>
        <h1 className="text-4xl font-black">{fr.nav.session}</h1>
        <Card>
          <p className="text-muted">{fr.session.noWeek}</p>
        </Card>
      </>
    );
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
    level: ctx.settings.session.level,
  });
  // Signature des étapes : si le menu change, les coches de la session repartent de zéro.
  const sig = session.steps.map((s) => `${s.name}@${s.start}`).join("|");
  if (household.role !== "viewer") {
    const supabase = await createClient();
    await supabase.rpc("session_ensure", { p_week: week.id, p_sig: sig });
  }

  return (
    <SessionScreen
      weekId={week.id}
      weekLabel={fr.menu.weekOf(formatShort(week.start_date))}
      steps={session.steps}
      total={session.total}
      plannedTime={ctx.settings.session.time}
      maxMinutes={ctx.settings.session.maxMinutes}
      doublesToBank={!week.plan.banked && (week.plan.doubles ?? []).length > 0}
      pantryToUpdate={!week.pantry_done}
    />
  );
}
