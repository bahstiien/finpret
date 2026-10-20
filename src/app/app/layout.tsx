import { redirect } from "next/navigation";
import { AppNav } from "@/components/ui/AppNav";
import { ToastProvider } from "@/components/ui/Toast";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold } from "@/server/session";

/** Onglets de l'application (§10) : il faut une session, un foyer configuré, et la navigation. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { household } = await requireHousehold("/app");
  const ctx = await loadHouseholdContext(household.id);
  if (!ctx.onboardedAt && household.role === "admin") redirect("/onboarding");
  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 px-4 pt-6 pb-32 min-[900px]:px-8 min-[900px]:pb-10">
        {/* TODO(M6) : nombre d'articles de courses restants (pastille rose). */}
        <AppNav shoppingLeft={0} />
        <main className="flex flex-col gap-5">{children}</main>
      </div>
    </ToastProvider>
  );
}
