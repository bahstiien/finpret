import "server-only";
import { sql } from "kysely";
import { hasBatch } from "@/engine/cooks";
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
import { milestoneMeals } from "@/server/progress-share";
import { loadHouseholdContext } from "@/server/household-context";
import { withSession } from "@/server/session";

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
  const ctx = await loadHouseholdContext(householdId);
  const today = todayIn(ctx.timezone);
  const active = activeWeekStart(today);

  const [settings, streakRows, achievements, cooks, catalogRows, weekRow] = await withSession((db) =>
    Promise.all([
      db.selectFrom("user_settings").select("notifications").where("user_id", "=", userId).executeTakeFirst(),
      db
        .selectFrom("streak_weeks")
        .select(["week_start", "outcome", "source", "closed_at"])
        .where("household_id", "=", householdId)
        .execute(),
      db
        .selectFrom("achievements")
        .select(["kind", "key", "seen_at"])
        .where("household_id", "=", householdId)
        .execute(),
      withPassport
        ? db
            .selectFrom("recipe_cooks")
            .innerJoin("recipes", "recipes.id", "recipe_cooks.recipe_id")
            .select([
              "recipe_cooks.recipe_id",
              "recipe_cooks.kind",
              "recipe_cooks.cooked_on",
              "recipes.origin",
              "recipes.months",
              "recipes.household_id",
              sql<{ m: number[] }[] | null>`recipes.data->'sv'`.as("sv"),
            ])
            .where("recipe_cooks.household_id", "=", householdId)
            .execute()
        : Promise.resolve([]),
      withPassport
        ? db
            .selectFrom("recipes")
            .select(["id", "name", "origin", "kind"])
            .where("household_id", "is", null)
            .where("is_active", "=", true)
            .execute()
        : Promise.resolve([]),
      db
        .selectFrom("weeks")
        .select("plan")
        .where("household_id", "=", householdId)
        .where("start_date", "=", active)
        .executeTakeFirst(),
    ]),
  );

  const history = streakRows.map((w) => ({
    weekStart: w.week_start,
    outcome: w.outcome,
    ...(w.source ? { source: w.source } : {}),
  }));
  const currentRow = history.find((w) => w.weekStart === active);
  const closed = history.filter((w) => w.weekStart < active);
  const plan = weekRow?.plan as unknown as Parameters<typeof hasBatch>[0] | undefined;
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

  const records = cooks.map((c): CookRecord => ({
    recipeId: c.recipe_id,
    cookedOn: c.cooked_on,
    kind: c.kind,
    origin: c.origin,
    isGlobal: c.household_id === null,
    ...(c.months ? { months: c.months } : {}),
    ...(c.sv ? { variantMonths: c.sv.map((v) => v.m) } : {}),
  }));
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
    visible: notificationsSchema.parse(settings?.notifications ?? {}).progress_visible,
    today,
    streak: {
      ...state,
      frise: buildFrise(closed, active, state.currentWeek),
      pauseOptions,
      hasHistory: history.some((w) => w.outcome === "done"),
    },
    countries: buildCountries(
      catalogRows.map((r) => ({
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
  const [settings, pending] = await withSession((db) =>
    Promise.all([
      db.selectFrom("user_settings").select("notifications").where("user_id", "=", userId).executeTakeFirst(),
      db
        .selectFrom("achievements")
        .select(["kind", "key"])
        .where("household_id", "=", householdId)
        .where("seen_at", "is", null)
        .execute(),
    ]),
  );
  if (!notificationsSchema.parse(settings?.notifications ?? {}).progress_visible) return null;
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
