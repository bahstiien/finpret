import { redirect } from "next/navigation";
import { SessionProvider, type SessionRow } from "@/components/session/SessionProvider";
import { TimerBar } from "@/components/session/TimerBar";
import { AppNav } from "@/components/ui/AppNav";
import { ToastProvider } from "@/components/ui/Toast";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold } from "@/server/session";
import { createClient } from "@/lib/supabase/server";
import { currentAndNext } from "@/server/weeks";

/** Onglets de l'application (§10) : il faut une session, un foyer configuré, et la navigation. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { household } = await requireHousehold("/app");
  const ctx = await loadHouseholdContext(household.id);
  if (!ctx.onboardedAt && household.role === "admin") redirect("/onboarding");
  const { current, next } = currentAndNext(ctx);
  const week = next ?? current;
  const supabase = await createClient();
  const { count } = week
    ? await supabase
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("week_id", week.id)
        .eq("checked", false)
    : { count: 0 };
  const { data: session } = week
    ? await supabase
        .from("sessions")
        .select("week_id, started_at, current_step, tasks_done, timers, updated_at")
        .eq("week_id", week.id)
        .maybeSingle()
    : { data: null };
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
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 px-4 pt-6 pb-32 min-[900px]:px-8 min-[900px]:pb-10">
          <AppNav shoppingLeft={count ?? 0} />
          <TimerBar />
          <main className="flex flex-col gap-5">{children}</main>
        </div>
      </SessionProvider>
    </ToastProvider>
  );
}
