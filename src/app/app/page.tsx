import type { Metadata } from "next";
import { type CanteenEntry, type MenuMode, MenuScreen, type PickerOption } from "@/components/menu/MenuScreen";
import { canteenDays, duplicateGroups } from "@/engine/canteen";
import { isRemoved, slotMap } from "@/engine/week";
import { NoWeek } from "@/components/menu/NoWeek";
import { eligible } from "@/engine/season";
import { monthOf } from "@/engine/compose";
import { ChecklistCard, type ChecklistCardData } from "@/components/getting-started/ChecklistCard";
import { TipBubble } from "@/components/getting-started/TipBubble";
import { PrepTile, type PrepData } from "@/components/getting-started/PrepTile";
import { STEPS, type StepKey } from "@/engine/getting-started";
import { effectiveLevel, endTime, packaging, prepTile } from "@/engine/first-session";
import { dur } from "@/engine/format";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { addDays, formatLong, timeIn } from "@/lib/dates";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { buildMenuView, canPrepareNext, flagOf } from "@/server/menu-view";
import { householdCan } from "@/server/entitlements-load";
import { firstSessionInfo, isFirstSessionFor, syncChecklist, tipForTab, tipsSeen } from "@/server/getting-started";
import { schoolMenusFor } from "@/server/school-canteen";
import { getProfile, getUser, requireHousehold, withSession } from "@/server/session";
import { currentAndNext, engineEnvFor, summarize } from "@/server/weeks";

export const metadata: Metadata = { title: fr.nav.menu };

/**
 * Onglet Menu (§8.1). `?week=next` affiche la semaine suivante déjà préparée ; `?vue=organiser` ouvre la grille et
 * les plats, `?vue=semaine` le carrousel du jour (par défaut : le carrousel quand la semaine a commencé).
 */
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; prep?: string; vue?: string }>;
}) {
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
  // Première session du foyer : niveau « débutant » par défaut (SPEC_PRISE_EN_MAIN §4.4.3).
  const first = await firstSessionInfo(household.id);
  const level = effectiveLevel({
    firstSession: isFirstSessionFor(first, row.id),
    override: first.override,
    setting: ctx.settings.session.level,
  });
  const summary = await summarize(ctx, row.plan, env, level);
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
    comfort: !!r.comfort,
    pasta: !!r.pasta,
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
    const menus = FEATURES.householdCanteen
      ? await withSession((db) =>
          db
            .selectFrom("canteen_menus")
            .select(["member_id", "date", "text"])
            .where("validated", "=", true)
            .where(
              "member_id",
              "in",
              kids.map((k) => k.id),
            )
            .where("date", "in", dates)
            .execute(),
        )
      : [];
    for (const m of menus) {
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

  // Prise en main (SPEC_PRISE_EN_MAIN §4.1, §4.2) : checklist du foyer et bulle de l'onglet, décidées côté serveur.
  const [checklist, tip] = await Promise.all([
    syncChecklist(household.id, { isAdmin: household.role === "admin" }),
    tipForTab("menu", { userId: authUser.id, householdId: household.id, timezone: ctx.timezone }),
  ]);

  // Tile « Demain, ta première session » et Sheet de préparation (§4.4.1, §4.4.2).
  const sessionWeek = next ?? current;
  const tileState = first.active
    ? prepTile({
        today,
        sessionDay: ctx.settings.session.day,
        hasWeek: !!sessionWeek,
        started: first.started,
        done: false,
      })
    : null;
  let prep: PrepData | null = null;
  if (tileState && sessionWeek) {
    const sessionPm = portionModelFor(ctx, sessionWeek.start_date);
    const pack = packaging(env, sessionWeek.plan, sessionPm);
    const weekId = sessionWeek.id;
    const [all, seen, sessionSummary] = await Promise.all([
      withSession((db) => db.selectFrom("shopping_items").select("checked").where("week_id", "=", weekId).execute()),
      tipsSeen(authUser.id),
      summarize(ctx, sessionWeek.plan, env, level),
    ]);
    prep = {
      state: tileState,
      today,
      boxes: pack.boxes.map((b) => ({ portions: b.portions, label: b.label, box: b.box })),
      fridge: pack.fridge,
      freezer: pack.freezer,
      shopping: { checked: all.filter((i) => i.checked).length, total: all.length },
      duration: dur(sessionSummary.sessionMinutes),
      end: endTime(ctx.settings.session.time, sessionSummary.sessionMinutes),
      level,
      isAdmin: household.role === "admin",
      tileDismissed: seen.includes(`prep_tile:${today}`),
      initialOpen: params.prep === "1",
    };
  }
  const checklistData: ChecklistCardData | null =
    checklist && !checklist.dismissed && checklist.state.mode !== "hidden"
      ? {
          mode: checklist.state.mode,
          done: Object.fromEntries(STEPS.map((k) => [k, checklist.state.steps[k].done])) as Record<StepKey, boolean>,
          doneCount: checklist.state.doneCount,
          total: checklist.state.total,
          next: checklist.state.next,
          autoCollapsed: checklist.state.autoCollapsed,
          isAdmin: checklist.isAdmin,
          sessionStarted: checklist.state.steps.start_session.done,
          prepareNextStart: isCurrent && !next && canPrepareNext(today) ? nextStart : null,
        }
      : null;
  // Une seule carte d'action : la Tile de la veille, sinon la checklist, sinon le bandeau de session.
  // La Tile reste montée même masquée : elle porte la Sheet ouverte par `?prep=1`.
  const tileVisible = !!prep && !prep.tileDismissed;
  const initialMode: MenuMode =
    params.vue === "organiser"
      ? "prep"
      : params.vue === "semaine" || (view.todayIndex >= 1 && view.todayIndex <= 7)
        ? "eat"
        : "prep";
  return (
    <>
      <MenuScreen
        key={`${row.id}:${params.vue ?? ""}`}
        header={header}
        view={view}
        canEdit={canEdit}
        sessionMinutes={row.frozen?.total ?? summary.sessionMinutes}
        frozen={!!row.frozen}
        weekendOptions={weekendOptions}
        cakeOptions={cakeOptions}
        shortcuts={shortcuts}
        childFactor={pm.childFactor}
        canteen={canteen}
        initialMode={initialMode}
        // Checklist réduite d'office (foyer de plus de 21 jours) : le bandeau de session reste visible.
        hideBanner={tileVisible || (!!checklistData && !checklistData.autoCollapsed)}
        topSlot={
          (checklistData || prep) && (
            <>
              {checklistData && !tileVisible && <ChecklistCard key="checklist" data={checklistData} />}
              {prep && <PrepTile key="prep" data={prep} />}
            </>
          )
        }
        dayTip={tip && <TipBubble key="tip" tip={tip} />}
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
