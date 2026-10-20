import type { Metadata } from "next";
import { MenuScreen, type PickerOption } from "@/components/menu/MenuScreen";
import { NoWeek } from "@/components/menu/NoWeek";
import { eligible } from "@/engine/season";
import { monthOf } from "@/engine/compose";
import { fr } from "@/i18n/fr";
import { formatLong, timeIn } from "@/lib/dates";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { buildMenuView, canPrepareNext, flagOf } from "@/server/menu-view";
import { getProfile, getUser, requireHousehold } from "@/server/session";
import { currentAndNext, engineEnvFor, summarize } from "@/server/weeks";

export const metadata: Metadata = { title: fr.nav.menu };

/** Onglet Menu (§8.1). `?week=next` affiche la semaine suivante déjà préparée. */
export default async function MenuPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { household } = await requireHousehold("/app");
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

  return (
    <MenuScreen
      header={header}
      view={view}
      canEdit={canEdit}
      sessionMinutes={summary.sessionMinutes}
      weekendOptions={weekendOptions}
      cakeOptions={cakeOptions}
      shortcuts={shortcuts}
      childFactor={pm.childFactor}
      weeks={{
        isCurrent,
        hasNext: !!next && isCurrent,
        hasCurrent: !!current && !isCurrent,
        nextStart,
        canPrepareNext: isCurrent && !next && canPrepareNext(today),
      }}
    />
  );
}
