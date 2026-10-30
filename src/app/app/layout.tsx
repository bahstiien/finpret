import { redirect } from "next/navigation";
import { SessionProvider, type SessionRow } from "@/components/session/SessionProvider";
import { TimerBar } from "@/components/session/TimerBar";
import { CelebrationHost } from "@/components/progress/CelebrationHost";
import { AppFrame } from "@/components/ui/AppFrame";
import { ToastProvider } from "@/components/ui/Toast";
import { loadCelebrations } from "@/server/progress-view";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold, withSession } from "@/server/session";
import { currentAndNext } from "@/server/weeks";

/** Onglets de l'application (§10) : il faut une session, un foyer configuré, et la navigation. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, household } = await requireHousehold("/app");
  const ctx = await loadHouseholdContext(household.id);
  if (!ctx.onboardedAt && household.role === "admin") redirect("/onboarding");
  const { current, next } = currentAndNext(ctx);
  const week = next ?? current;
  const { count, session } = week
    ? await withSession(async (db) => ({
        count: (
          await db
            .selectFrom("shopping_items")
            .select((eb) => eb.fn.countAll<number>().as("n"))
            .where("week_id", "=", week.id)
            .where("checked", "=", false)
            .executeTakeFirstOrThrow()
        ).n,
        session:
          (await db
            .selectFrom("sessions")
            .select(["week_id", "started_at", "current_step", "tasks_done", "timers", "updated_at"])
            .where("week_id", "=", week.id)
            .executeTakeFirst()) ?? null,
      }))
    : { count: 0, session: null };
  const celebrations = await loadCelebrations(household.id, user.id);
  return (
    <ToastProvider>
      <SessionProvider
        householdId={household.id}
        weekId={week?.id ?? null}
        initial={(session as unknown as SessionRow | null) ?? null}
        canEdit={household.role !== "viewer"}
        sound={ctx.settings.session.sound}
        vibration={ctx.settings.session.vibration}
      >
        <AppFrame
          shoppingLeft={count ?? 0}
          top={<TimerBar />}
          overlay={celebrations ? <CelebrationHost data={celebrations} /> : null}
        >
          {children}
        </AppFrame>
      </SessionProvider>
    </ToastProvider>
  );
}
