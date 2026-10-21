import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  ConfirmDelete,
  NotificationsForm,
  ProfileNameForm,
  SignOutOthers,
  ThemeForm,
} from "@/components/settings/ProfileForms";
import { type CanteenChild, CanteenForm } from "@/components/settings/CanteenForms";
import { DietForm, MenuForm, SessionForm, ShoppingForm } from "@/components/settings/SectionForms";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { addDays, formatShort, isoWeekday, mondayOf, todayIn } from "@/lib/dates";
import { canteenDays } from "@/engine/canteen";
import { notificationsSchema } from "@/lib/settings";
import { ADMIN_SECTIONS, type SettingsSection } from "@/lib/settings-sections";
import { createClient } from "@/lib/supabase/server";
import { leaveHousehold, switchHousehold } from "@/server/actions/households";
import { signOut } from "@/server/actions/auth";
import { deleteAccount, deleteHousehold } from "@/server/actions/settings";
import { loadHouseholdContext } from "@/server/household-context";
import { getHouseholds, getProfile, requireHousehold } from "@/server/session";
import { buttonClass } from "@/components/ui/Button";

const t = fr.settings;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return { title: t.sections[section as SettingsSection] ?? t.title };
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: raw } = await params;
  if (raw === "notifications") redirect("/settings/profile#notifications");
  if (!(ADMIN_SECTIONS as readonly string[]).includes(raw)) notFound();
  const section = raw as SettingsSection;
  const { user, household } = await requireHousehold(`/settings/${section}`);
  // Réservé à l'administrateur, sauf la section Profil (§6).
  if (section !== "profile" && household.role !== "admin") redirect("/settings/profile");
  const ctx = await loadHouseholdContext(household.id);
  const supabase = await createClient();

  switch (section) {
    case "household":
      redirect("/settings/household");
    case "diet": {
      const { data } = await supabase
        .from("ingredients")
        .select("key, label")
        .neq("aisle", "base")
        .order("label");
      return <DietForm initial={ctx.settings.diet} ingredients={data ?? []} />;
    }
    case "menu":
      return <MenuForm initial={ctx.settings.menu} />;
    case "session":
      return <SessionForm initial={ctx.settings.session} equipment={ctx.settings.equipment} />;
    case "shopping": {
      const [aisles, base] = await Promise.all([
        supabase.from("aisles").select("key, label").neq("key", "base").order("position"),
        supabase.from("ingredients").select("key, label").eq("aisle", "base").order("label"),
      ]);
      return (
        <ShoppingForm
          initial={ctx.settings.shopping}
          aisles={aisles.data ?? []}
          baseIngredients={base.data ?? []}
        />
      );
    }
    case "canteen": {
      const today = todayIn(ctx.timezone);
      const kids = ctx.members.filter((m) => m.kind === "child" && !m.archived);
      const { data: menus } = kids.length
        ? await supabase
            .from("canteen_menus")
            .select("member_id, date, text, validated")
            .in(
              "member_id",
              kids.map((k) => k.id),
            )
            // Menus à venir, et tous les menus importés encore à valider.
            .or(`and(date.gte.${today},date.lte.${addDays(today, 27)}),validated.eq.false`)
            .order("date")
        : { data: [] };
      const isCanteenDay = (id: string, date: string) =>
        canteenDays(
          kids.find((k) => k.id === id)!,
          ctx.presence,
          mondayOf(date),
          ctx.alternatingFrom,
        ).includes(isoWeekday(date));
      const children: CanteenChild[] = kids.map((k) => {
        const mine = (menus ?? []).filter((m) => m.member_id === k.id);
        const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter((d) =>
          isCanteenDay(k.id, d),
        );
        return {
          id: k.id,
          name: k.name,
          days: canteenDays(k, ctx.presence, mondayOf(today), ctx.alternatingFrom),
          upcoming: dates.map((date) => ({
            date,
            label: formatShort(date),
            text: mine.find((m) => m.date === date && m.validated)?.text ?? "",
          })),
          pending: mine
            .filter((m) => !m.validated)
            .map((m) => ({ date: m.date, label: formatShort(m.date), text: m.text })),
        };
      });
      return <CanteenForm initial={ctx.settings.canteen} kids={children} canEdit />;
    }
    case "data":
      return (
        <>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold">{t.data.export}</h2>
            <p className="text-sm text-muted">{t.data.exportHint}</p>
            <a href="/settings/data/export" download className={buttonClass({ className: "self-start" })}>
              {t.data.export}
            </a>
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold">{t.data.history}</h2>
            {ctx.weeks.length ? (
              <ul className="flex flex-col divide-y divide-line" data-testid="weeks-history">
                {ctx.weeks.map((w) => (
                  <li key={w.id} className="py-2">
                    {fr.menu.weekOf(formatShort(w.start_date))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.data.noHistory}</p>
            )}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold">{t.data.deleteHousehold}</h2>
            <ConfirmDelete
              action={deleteHousehold}
              label={t.data.deleteHousehold}
              hint={t.data.deleteHouseholdHint(ctx.name)}
            />
          </Card>
        </>
      );
    case "profile": {
      const [profile, households, userSettings] = await Promise.all([
        getProfile(),
        getHouseholds(),
        supabase.from("user_settings").select("notifications").eq("user_id", user.id).maybeSingle(),
      ]);
      const notifications = notificationsSchema.safeParse(userSettings.data?.notifications ?? {});
      return (
        <>
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-extrabold">{t.profile.you}</h2>
            <ProfileNameForm initial={profile?.display_name ?? ""} />
            <p className="text-sm text-muted">{user.email}</p>
          </Card>
          {households.length > 1 && (
            <Card>
              <form action={switchHousehold} className="flex flex-wrap items-end gap-3">
                <SelectField
                  id="householdId"
                  name="householdId"
                  label={t.profile.activeHousehold}
                  defaultValue={household.id}
                  className="min-w-56 flex-1"
                >
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </SelectField>
                <Button type="submit" variant="outline">
                  {fr.household.switch}
                </Button>
              </form>
            </Card>
          )}
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold">{t.profile.theme}</h2>
            <ThemeForm />
          </Card>
          <Card className="flex flex-col gap-4" id="notifications">
            <h2 className="text-xl font-extrabold">{t.profile.notifications}</h2>
            <NotificationsForm
              initial={notifications.success ? notifications.data : notificationsSchema.parse({})}
            />
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold">{t.profile.devices}</h2>
            <p className="text-sm text-muted">{t.profile.devicesHint}</p>
            <SignOutOthers />
          </Card>
          <Card className="flex flex-col gap-3">
            <form action={signOut}>
              <Button type="submit" variant="outline">
                {fr.appShell.signOut}
              </Button>
            </form>
          </Card>
          <Card className="flex flex-col gap-3">
            <ActionForm
              action={leaveHousehold}
              fields={{ householdId: household.id }}
              label={t.profile.leave}
              confirm={fr.settingsHousehold.leaveConfirm}
              variant="outline"
            />
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold">{t.data.deleteAccount}</h2>
            <ConfirmDelete
              action={deleteAccount}
              label={t.data.deleteAccount}
              hint={t.data.deleteAccountHint}
            />
          </Card>
        </>
      );
    }
  }
}
