import "server-only";
import { coveredMeals, hasBatch } from "@/engine/cooks";
import type { WeekPlan } from "@/engine/types";
import { countryLabel, seasonCounts, type CookRecord } from "@/engine/passport";
import {
  buildCountries,
  buildFrise,
  buildSeasons,
  type CountryEntry,
  type FriseWeek,
  type SeasonEntry,
} from "@/engine/progress-view";
import {
  activeWeekStart,
  computeStreak,
  pausesUsedInQuarter,
  PAUSES_PER_QUARTER,
  type StreakState,
} from "@/engine/streak";
import { fr } from "@/i18n/fr";
import { addDays, mondayOf, todayIn } from "@/lib/dates";
import { notificationsSchema } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { milestoneMeals } from "@/server/progress-share";
import { loadHouseholdContext } from "@/server/household-context";

export type PauseOption = { weekStart: string; planned: boolean; disabled: boolean };
export type PendingAchievement = { kind: "streak" | "country" | "season"; key: string; label: string };

/** Libellé français d'un tampon ou d'un palier : « Japon », « Automne 2027 », « 12 semaines fin prêtes ». */
export function achievementLabel(kind: "streak" | "country" | "season", key: string): string {
  if (kind === "country") return countryLabel(key);
  if (kind === "streak") return fr.progress.streak.milestoneTitle(Number(key));
  const [year, season] = key.split("-");
  const name = fr.progress.passport.seasons[season as keyof typeof fr.progress.passport.seasons] ?? key;
  return fr.progress.passport.seasonLabel(name, Number(year));
}

export type ProgressView = {
  /** Réglage du compte : masqué = pas de tuile, de ligne de fin de session ni de feuille de célébration. */
  visible: boolean;
  today: string;
  streak: StreakState & { frise: FriseWeek[]; pauseOptions: PauseOption[]; hasHistory: boolean };
  countries: CountryEntry[];
  seasons: SeasonEntry[];
  /** Tampons et paliers inscrits mais jamais célébrés. */
  pending: PendingAchievement[];
};

/** Tout l'écran « Nos progrès » (RLS : lecture par le client de l'utilisateur, aucune écriture). */
export async function loadProgressView(
  householdId: string,
  userId: string,
  options: { passport?: boolean } = {},
): Promise<ProgressView> {
  const withPassport = options.passport ?? true;
  const supabase = await createClient();
  const ctx = await loadHouseholdContext(householdId);
  const today = todayIn(ctx.timezone);
  const active = activeWeekStart(today);

  const [settings, streakRows, achievementRows, cookRows, catalogRows, weekRow] = await Promise.all([
    supabase.from("user_settings").select("notifications").eq("user_id", userId).maybeSingle(),
    supabase
      .from("streak_weeks")
      .select("week_start, outcome, source, closed_at")
      .eq("household_id", householdId),
    supabase.from("achievements").select("kind, key, seen_at").eq("household_id", householdId),
    withPassport
      ? supabase
          .from("recipe_cooks")
          .select("recipe_id, kind, cooked_on, recipes(origin, months, household_id, sv:data->sv)")
          .eq("household_id", householdId)
      : Promise.resolve({ data: [] as never[] }),
    withPassport
      ? supabase
          .from("recipes")
          .select("id, name, origin, kind")
          .is("household_id", null)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("weeks")
      .select("plan")
      .eq("household_id", householdId)
      .eq("start_date", active)
      .maybeSingle(),
  ]);

  const history = (streakRows.data ?? []).map((w) => ({
    weekStart: w.week_start,
    outcome: w.outcome,
    ...(w.source ? { source: w.source } : {}),
  }));
  const currentRow = history.find((w) => w.weekStart === active);
  const closed = history.filter((w) => w.weekStart < active);
  const achievements = achievementRows.data ?? [];
  const plan = weekRow.data?.plan as unknown as Parameters<typeof hasBatch>[0] | undefined;
  const state = computeStreak(
    closed,
    {
      weekStart: active,
      sessionDone: currentRow?.outcome === "done",
      hasBatch: plan ? hasBatch(plan) : true,
      plannedPause: currentRow?.outcome === "paused" && currentRow.source === "planned",
    },
    achievements.filter((a) => a.kind === "streak").map((a) => Number(a.key)),
  );

  const thisMonday = mondayOf(today);
  const pauseOptions: PauseOption[] = Array.from({ length: 8 }, (_, i) => {
    const weekStart = addDays(thisMonday, 7 * (i + 1));
    const planned = history.some((w) => w.weekStart === weekStart && w.outcome === "paused");
    const full = pausesUsedInQuarter(history, weekStart) >= PAUSES_PER_QUARTER;
    return {
      weekStart,
      planned,
      disabled: !planned && (full || history.some((w) => w.weekStart === weekStart)),
    };
  });

  const cooks = cookRows.data ?? [];
  const records = cooks.flatMap((c): CookRecord[] => {
    const r = c.recipes as unknown as {
      origin: string | null;
      months: number[] | null;
      household_id: string | null;
      sv: { m: number[] }[] | null;
    } | null;
    if (!r) return [];
    return [
      {
        recipeId: c.recipe_id,
        cookedOn: c.cooked_on,
        kind: c.kind,
        origin: r.origin,
        isGlobal: r.household_id === null,
        ...(r.months ? { months: r.months } : {}),
        ...(r.sv ? { variantMonths: r.sv.map((v) => v.m) } : {}),
      },
    ];
  });
  const globalCooks = records
    .filter((r) => r.isGlobal)
    .map((r) => ({ recipeId: r.recipeId, cookedOn: r.cookedOn }));
  const earnedSeasons = new Set(achievements.filter((a) => a.kind === "season").map((a) => a.key));

  const pending = achievements
    .filter((a) => !a.seen_at)
    .map((a): PendingAchievement => ({
      kind: a.kind,
      key: a.key,
      label: achievementLabel(a.kind, a.key),
    }));

  return {
    visible: notificationsSchema.parse(settings.data?.notifications ?? {}).progress_visible,
    today,
    streak: {
      ...state,
      frise: buildFrise(closed, active, state.currentWeek),
      pauseOptions,
      hasHistory: history.some((w) => w.outcome === "done"),
    },
    countries: buildCountries(
      (catalogRows.data ?? []).map((r) => ({
        id: r.id,
        name: r.name ?? r.id,
        origin: r.origin,
        kind: r.kind,
      })),
      globalCooks,
    ),
    seasons: buildSeasons(today, seasonCounts(records), earnedSeasons),
    pending,
  };
}

export type Celebrations = {
  stamps: { kind: "country" | "season"; key: string; label: string }[];
  milestone: { weeks: number; meals: number } | null;
};

/** Tampons et palier jamais célébrés (une seule feuille par tampon, `achievements.seen_at`). Rien si masqué. */
export async function loadCelebrations(householdId: string, userId: string): Promise<Celebrations | null> {
  const supabase = await createClient();
  const [settings, rows] = await Promise.all([
    supabase.from("user_settings").select("notifications").eq("user_id", userId).maybeSingle(),
    supabase.from("achievements").select("kind, key").eq("household_id", householdId).is("seen_at", null),
  ]);
  if (!notificationsSchema.parse(settings.data?.notifications ?? {}).progress_visible) return null;
  const pending = rows.data ?? [];
  if (pending.length === 0) return null;
  const milestones = pending.filter((a) => a.kind === "streak").map((a) => Number(a.key));
  const top = milestones.length ? Math.max(...milestones) : null;
  return {
    stamps: pending
      .filter((a): a is { kind: "country" | "season"; key: string } => a.kind !== "streak")
      .map((a) => ({ ...a, label: achievementLabel(a.kind, a.key) })),
    milestone: top ? { weeks: top, meals: await milestoneMeals(householdId, top) } : null,
  };
}

export type ProgressStats = { sessions: number; meals: number };

/** Bandeau de chiffres de « Nos progrès » : sessions terminées et repas couverts (deux lectures, RLS). */
export async function loadProgressStats(householdId: string): Promise<ProgressStats> {
  const supabase = await createClient();
  const { data: done } = await supabase
    .from("streak_weeks")
    .select("week_start")
    .eq("household_id", householdId)
    .eq("outcome", "done");
  const starts = (done ?? []).map((w) => w.week_start);
  if (starts.length === 0) return { sessions: 0, meals: 0 };
  const { data: weeks } = await supabase
    .from("weeks")
    .select("plan")
    .eq("household_id", householdId)
    .in("start_date", starts);
  return {
    sessions: starts.length,
    meals: (weeks ?? []).reduce((sum, w) => sum + coveredMeals(w.plan as unknown as WeekPlan), 0),
  };
}
