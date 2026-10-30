import type { Metadata } from "next";
import { type CanteenEntry, MenuScreen, type PickerOption } from "@/components/menu/MenuScreen";
import { canteenDays, duplicateGroups } from "@/engine/canteen";
import { isRemoved, slotMap } from "@/engine/week";
import { createClient } from "@/lib/supabase/server";
import { loadProgressView } from "@/server/progress-view";
import { NoWeek } from "@/components/menu/NoWeek";
import { eligible } from "@/engine/season";
import { monthOf } from "@/engine/compose";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { addDays, formatLong, timeIn } from "@/lib/dates";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { buildMenuView, canPrepareNext, flagOf } from "@/server/menu-view";
import { householdCan } from "@/server/entitlements-load";
import { schoolMenusFor } from "@/server/school-canteen";
import { getProfile, getUser, requireHousehold } from "@/server/session";
import { currentAndNext, engineEnvFor, summarize } from "@/server/weeks";

export const metadata: Metadata = { title: fr.nav.menu };

/** Onglet Menu (§8.1). `?week=next` affiche la semaine suivante déjà préparée. */
export default async function MenuPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { user: authUser, household } = await requireHousehold("/app");
  const [ctx, profile, user, params] = await Promise.all([
    loadHouseholdContext(household.id),
    getProfile(),
    getUser(),
    searchParams,
  ]);
  const canEdit = household.role !== "viewer";
  const { today, current, next, nextStart } = currentAndNext(ctx);
  const showNext = params.week === "next" && next;
  const row = showNext ? next : (current ?? next);
  const hour = Number(timeIn(ctx.timezone).slice(0, 2));
  const header = {
    date: formatLong(today),
    greeting: hour >= 18 ? fr.menuScreen.evening : fr.menuScreen.morning,
    // TODO(spec) §16 Q2 : prénom du membre lié au compte, sinon celui du profil.
    name:
      ctx.members.find((m) => m.userId === user?.id)?.name ??
      profile?.display_name ??
      user?.email?.split("@")[0] ??
      "",
  };
  if (!row) return <NoWeek header={header} canEdit={canEdit} start={nextStart} />;

  const env = await engineEnvFor(ctx);
  const pm = portionModelFor(ctx, row.start_date);
  const view = buildMenuView(ctx, env, row, pm, today);
  const summary = await summarize(ctx, row.plan, env);
  const month = monthOf(row.start_date);
  const quick = (r: { steps?: string[]; prepMin?: number; blocks?: { active: number; passive: number }[] }) =>
    !!r.steps || (r.prepMin ?? 0) + (r.blocks ?? []).reduce((s, b) => s + b.active + b.passive, 0) <= 30;
  const weekendOptions: PickerOption[] = [...env.lib.simples, ...env.lib.mains].map((r) => ({
    id: r.id,
    name: r.n,
    short: r.s,
    flag: flagOf(r.o),
    seasonal: eligible(env, r, month),
    quick: quick(r),
    favorite: env.ratings[r.id] === 1,
    type: "steps" in r ? "simple" : "main",
  }));
  const cakeOptions: PickerOption[] = env.lib.cakes.map((c) => ({
    id: c.id,
    name: c.n,
    short: c.n,
    flag: null,
    seasonal: !c.months || c.months.includes(month),
    quick: false,
    favorite: false,
    type: c.t,
  }));
  const active = ctx.members.filter((m) => !m.archived);
  const shortcuts = {
    family: {
      a: active.filter((m) => m.kind === "adult").length,
      c: active.filter((m) => m.kind === "child").length,
    },
    adults: { a: active.filter((m) => m.kind === "adult").length, c: 0 },
  };
  const isCurrent = row === current;

  // Cantine (§13) : menus validés des enfants les jours de cantine, et alerte doublon avec le dîner.
  const canteen: Record<string, CanteenEntry[]> = {};
  const kids = ctx.members.filter((m) => m.kind === "child" && !m.archived);
  // Offre : cantine gratuite pour un foyer rattaché à une association (D12), payante sinon.
  const [canCanteen, canAlert] = await Promise.all([
    householdCan(household.id, "canteen"),
    householdCan(household.id, "canteen.alert"),
  ]);
  if (kids.length && canCanteen) {
    const dates = Array.from({ length: 5 }, (_, i) => addDays(row.start_date, i));
    const slots = slotMap(env, row.plan);
    const dinnerOf = (date: string) => {
      const day = dates.indexOf(date) + 1;
      return isRemoved(row.plan, day, "dinner") ? null : (slots[`${day}-dinner`]?.r ?? null);
    };
    // Menus publiés par l'association pour l'école de l'enfant : prioritaires sur la saisie du foyer.
    const school = await schoolMenusFor(kids, dates);
    const covered = new Set(school.map((m) => `${m.memberId}:${m.date}`));
    for (const m of school) {
      (canteen[m.date] ??= []).push({
        name: m.name,
        text: m.text,
        note: m.note,
        edited: m.edited,
        duplicates:
          canAlert && ctx.settings.canteen.alert ? duplicateGroups(env.lib, m.text, dinnerOf(m.date)) : [],
      });
    }
    const supabase = await createClient();
    const { data: menus } = FEATURES.householdCanteen
      ? await supabase
          .from("canteen_menus")
          .select("member_id, date, text")
          .eq("validated", true)
          .in(
            "member_id",
            kids.map((k) => k.id),
          )
          .in("date", dates)
      : { data: [] };
    for (const m of menus ?? []) {
      const kid = kids.find((k) => k.id === m.member_id)!;
      if (covered.has(`${kid.id}:${m.date}`)) continue;
      const day = dates.indexOf(m.date) + 1;
      if (!canteenDays(kid, ctx.presence, row.start_date, ctx.alternatingFrom).includes(day)) continue;
      const dinner = isRemoved(row.plan, day, "dinner") ? null : (slots[`${day}-dinner`]?.r ?? null);
      (canteen[m.date] ??= []).push({
        name: kid.name,
        text: m.text,
        duplicates: canAlert && ctx.settings.canteen.alert ? duplicateGroups(env.lib, m.text, dinner) : [],
      });
    }
  }

  const progress = await loadProgressView(household.id, authUser.id, { passport: false });
  return (
    <>
      <MenuScreen
        streak={progress.visible ? progress.streak : null}
        header={header}
        view={view}
        canEdit={canEdit}
        sessionMinutes={summary.sessionMinutes}
        weekendOptions={weekendOptions}
        cakeOptions={cakeOptions}
        shortcuts={shortcuts}
        childFactor={pm.childFactor}
        canteen={canteen}
        weeks={{
          isCurrent,
          hasNext: !!next && isCurrent,
          hasCurrent: !!current && !isCurrent,
          nextStart,
          canPrepareNext: isCurrent && !next && canPrepareNext(today),
        }}
      />
    </>
  );
}
