import type { Metadata } from "next";
import { TipBubble } from "@/components/getting-started/TipBubble";
import { firstSessionInfo, isFirstSessionFor, tipForTab, tipsSeen } from "@/server/getting-started";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Layout";
import { SessionScreen } from "@/components/session/SessionScreen";
import { effectiveLevel } from "@/engine/first-session";
import { FIRST_SESSION_TIPS } from "@/engine/getting-started";
import { totals } from "@/engine/quantities";
import { buildSession } from "@/engine/session";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { toEquipment } from "@/lib/settings";
import { rpcRows } from "@/server/db";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { requireHousehold, withSession } from "@/server/session";
import { currentAndNext, engineEnvFor } from "@/server/weeks";

export const metadata: Metadata = { title: fr.nav.session };

/** Onglet Session (§8.5) : la session de la semaine préparée (ou en cours), étape par étape. */
export default async function SessionPage() {
  const { user, household } = await requireHousehold("/app/session");
  const ctx = await loadHouseholdContext(household.id);
  const { current, next } = currentAndNext(ctx);
  const week = next ?? current;
  if (!week) {
    return (
      <>
        <PageHeader title={fr.nav.session} />
        <EmptyState
          icon="timer"
          title={fr.gettingStarted.empty.sessionNoWeek.title}
          action={<LinkButton href="/app">{fr.gettingStarted.empty.sessionNoWeek.action}</LinkButton>}
        >
          {fr.gettingStarted.empty.sessionNoWeek.text}
        </EmptyState>
      </>
    );
  }
  const tip = await tipForTab("session", { userId: user.id, householdId: household.id, timezone: ctx.timezone });
  // Première session du foyer : « débutant » par défaut, modifiable (SPEC_PRISE_EN_MAIN §4.4.3).
  const [first, seen] = await Promise.all([firstSessionInfo(household.id), tipsSeen(user.id)]);
  const firstWeek = isFirstSessionFor(first, week.id);
  const level = effectiveLevel({
    firstSession: firstWeek,
    override: first.override,
    setting: ctx.settings.session.level,
  });
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
  // Signature des étapes : si le menu change, les coches de la session repartent de zéro.
  const sig = session.steps.map((s) => `${s.name}@${s.start}`).join("|");
  if (household.role !== "viewer") {
    await withSession((db) => rpcRows(db, "session_ensure", { p_week: week.id, p_sig: sig })).catch(
      () => null,
    );
  }

  return (
    <SessionScreen
      tip={tip && <TipBubble key="tip" tip={tip} />}
      firstSession={firstWeek ? { level, seen: seen.filter((k) => (FIRST_SESSION_TIPS as readonly string[]).includes(k)) } : null}
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
