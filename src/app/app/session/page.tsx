import type { Metadata } from "next";
import { TipBubble } from "@/components/getting-started/TipBubble";
import { tipForTab, tipsSeen } from "@/server/getting-started";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Layout";
import { SessionScreen } from "@/components/session/SessionScreen";
import { FIRST_SESSION_TIPS } from "@/engine/getting-started";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { rpcRows } from "@/server/db";
import { loadHouseholdContext } from "@/server/household-context";
import { weekSession } from "@/server/session-plan";
import { requireHousehold, withSession } from "@/server/session";
import { currentAndNext } from "@/server/weeks";

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
  const seen = await tipsSeen(user.id);
  const { firstWeek, level, steps, total } = await weekSession(ctx, week);
  // Signature des étapes : si le menu change avant le lancement, les coches repartent de zéro (figées ensuite).
  const sig = steps.map((s) => `${s.name}@${s.start}`).join("|");
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
      steps={steps}
      total={total}
      plannedTime={ctx.settings.session.time}
      maxMinutes={ctx.settings.session.maxMinutes}
      doublesToBank={!week.plan.banked && (week.plan.doubles ?? []).length > 0}
      pantryToUpdate={!week.pantry_done}
    />
  );
}
