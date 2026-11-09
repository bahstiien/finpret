import "server-only";
import { sql } from "kysely";
import { ENGAGEMENT_EVENTS, type UsageRange } from "@/lib/admin-usage";
import { withAdmin } from "@/server/db";

const count = sql<number>`count(*)`.as("n");
const num = (row: { n: number | string | null } | undefined) => Number(row?.n ?? 0);
const TZ = "Europe/Paris";

export type RecipeOpinion = {
  id: string;
  name: string;
  origin: string | null;
  liked: number;
  kids: number;
  refused: number;
  tooLong: number;
  /** Foyers qui ont déjà cuisiné la recette (toutes périodes). */
  cookedBy: number;
};

/**
 * Données de la page « Usage et communauté » : sessions de batch cooking terminées, recettes cuisinées, avis des
 * foyers, anti-gaspi, série et événements d'engagement. Lecture seule, avec la clé de service (back-office).
 * Les avis (`ratings`) n'ont pas de date : ils sont comptés depuis le début.
 */
export async function usageData(range: UsageRange) {
  const { since, prevSince, unit } = range;
  // Instants convertis en heure de Paris avant d'en tirer le jour.
  const local = (col: string) => sql`(${sql.ref(col)} at time zone ${TZ})`;
  /** Jour ou lundi de la barre du graphique ; `date` pour une colonne déjà en date, sinon un instant. */
  const bucket = (col: string, type: "date" | "instant") =>
    sql<string>`to_char(date_trunc(${unit}, ${type === "date" ? sql`${sql.ref(col)}::timestamp` : local(col)}), 'YYYY-MM-DD')`.as(
      "key",
    );
  const inPeriod = (col: string) => sql<boolean>`${local(col)}::date >= ${since}::date`;
  const inPrev = (col: string) =>
    sql<boolean>`${local(col)}::date >= ${prevSince}::date and ${local(col)}::date < ${since}::date`;

  return withAdmin(async (db) => {
    // --- Sessions de batch cooking -------------------------------------------------------------
    const sessions = await db
      .selectFrom("sessions")
      .select([
        sql<number>`count(*) filter (where done_at is not null and ${inPeriod("done_at")})`.as("done"),
        sql<number>`count(*) filter (where done_at is not null and ${inPrev("done_at")})`.as("donePrev"),
        sql<number>`count(*) filter (where started_at is not null and ${inPeriod("started_at")})`.as(
          "started",
        ),
        sql<number>`count(*) filter (where started_at is not null and done_at is null and ${inPeriod("started_at")} and started_at < now() - interval '1 day')`.as(
          "abandoned",
        ),
        sql<number>`count(distinct household_id) filter (where done_at is not null and ${inPeriod("done_at")})`.as(
          "households",
        ),
        sql<number>`count(distinct household_id) filter (where done_at is not null and ${inPrev("done_at")})`.as(
          "householdsPrev",
        ),
        // Durée réelle : de la première étape ouverte à la fin, en excluant les sessions laissées ouvertes des heures.
        sql<
          number | null
        >`percentile_cont(0.5) within group (order by extract(epoch from done_at - started_at) / 60) filter (where done_at is not null and started_at is not null and ${inPeriod("done_at")} and done_at - started_at between interval '10 minutes' and interval '8 hours')`.as(
          "medianMinutes",
        ),
      ])
      .executeTakeFirstOrThrow();
    const sessionSeries = await db
      .selectFrom("sessions")
      .select([bucket("done_at", "instant"), count])
      .where("done_at", "is not", null)
      .where(inPeriod("done_at"))
      .groupBy(sql`1`)
      .execute();
    const sessionWeekdays = await db
      .selectFrom("sessions")
      .select([sql<number>`extract(isodow from ${local("done_at")})::int`.as("dow"), count])
      .where("done_at", "is not", null)
      .where(inPeriod("done_at"))
      .groupBy(sql`1`)
      .execute();
    const menus = num(
      await db.selectFrom("weeks").select(count).where(inPeriod("created_at")).executeTakeFirst(),
    );

    // --- Recettes cuisinées ----------------------------------------------------------------------
    const cooks = await db
      .selectFrom("recipe_cooks as c")
      .innerJoin("recipes as r", "r.id", "c.recipe_id")
      .select([
        sql<number>`count(*) filter (where c.cooked_on >= ${since}::date)`.as("total"),
        sql<number>`count(*) filter (where c.cooked_on >= ${prevSince}::date and c.cooked_on < ${since}::date)`.as(
          "prev",
        ),
        sql<number>`count(distinct c.recipe_id) filter (where c.cooked_on >= ${since}::date)`.as("distinct"),
        sql<number>`count(*) filter (where c.cooked_on >= ${since}::date and r.household_id is not null)`.as(
          "imported",
        ),
      ])
      .executeTakeFirstOrThrow();
    const catalog = num(
      await db
        .selectFrom("recipes")
        .select(count)
        .where("household_id", "is", null)
        .where("is_active", "=", true)
        .where("kind", "in", ["main", "soup", "simple"])
        .executeTakeFirst(),
    );
    const cookSeries = await db
      .selectFrom("recipe_cooks")
      .select([bucket("cooked_on", "date"), count])
      .where("cooked_on", ">=", since)
      .groupBy(sql`1`)
      .execute();
    const byKind = await db
      .selectFrom("recipe_cooks")
      .select(["kind", count])
      .where("cooked_on", ">=", since)
      .groupBy("kind")
      .execute();
    const byProtein = await db
      .selectFrom("recipe_cooks as c")
      .innerJoin("recipes as r", "r.id", "c.recipe_id")
      .select([sql<string>`coalesce(r.protein, 'autre')`.as("protein"), count])
      .where("c.cooked_on", ">=", since)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .execute();
    const byOrigin = await db
      .selectFrom("recipe_cooks as c")
      .innerJoin("recipes as r", "r.id", "c.recipe_id")
      .select(["r.origin", count])
      .where("c.cooked_on", ">=", since)
      .where("r.origin", "is not", null)
      .groupBy("r.origin")
      .orderBy(sql`2 desc`)
      .limit(10)
      .execute();
    const topRecipes = await db
      .selectFrom("recipe_cooks as c")
      .innerJoin("recipes as r", "r.id", "c.recipe_id")
      .select([
        "r.id",
        "r.name",
        "r.kind",
        "r.origin",
        count,
        sql<number>`count(distinct c.household_id)`.as("households"),
      ])
      .where("c.cooked_on", ">=", since)
      .groupBy(["r.id", "r.name", "r.kind", "r.origin"])
      .orderBy(sql`5 desc`)
      .orderBy("r.name")
      .limit(10)
      .execute();

    // --- Avis de la communauté (sans date : depuis le début) -------------------------------------
    const ratingTotals = await db
      .selectFrom("ratings")
      .select([
        count,
        sql<number>`count(distinct household_id)`.as("households"),
        sql<number>`count(*) filter (where value = 1)`.as("liked"),
        sql<number>`count(*) filter (where value = -1)`.as("refused"),
        sql<number>`count(*) filter (where kids_liked)`.as("kids"),
        sql<number>`count(*) filter (where too_long)`.as("tooLong"),
      ])
      .executeTakeFirstOrThrow();
    const cookingHouseholds = num(
      await db
        .selectFrom("recipe_cooks")
        .select(sql<number>`count(distinct household_id)`.as("n"))
        .executeTakeFirst(),
    );
    const opinions = await db
      .selectFrom("ratings as g")
      .innerJoin("recipes as r", "r.id", "g.recipe_id")
      .select([
        "r.id",
        "r.name",
        "r.origin",
        sql<number>`count(*) filter (where g.value = 1)`.as("liked"),
        sql<number>`count(*) filter (where g.kids_liked)`.as("kids"),
        sql<number>`count(*) filter (where g.value = -1)`.as("refused"),
        sql<number>`count(*) filter (where g.too_long)`.as("tooLong"),
        sql<number>`(select count(distinct c.household_id) from recipe_cooks c where c.recipe_id = r.id)`.as(
          "cookedBy",
        ),
      ])
      .groupBy(["r.id", "r.name", "r.origin"])
      .execute();

    // --- Anti-gaspi, série, imports, engagement ----------------------------------------------------
    const saves = await db
      .selectFrom("pantry_saves")
      .select([
        count,
        sql<number>`count(*) filter (where urgent)`.as("urgent"),
        sql<number>`count(distinct household_id)`.as("households"),
      ])
      .where("saved_on", ">=", since)
      .executeTakeFirstOrThrow();
    const topSaved = await db
      .selectFrom("pantry_saves as s")
      .innerJoin("ingredients as i", "i.key", "s.ingredient_key")
      .select(["i.label", count])
      .where("s.saved_on", ">=", since)
      .groupBy("i.label")
      .orderBy(sql`2 desc`)
      .orderBy("i.label")
      .limit(8)
      .execute();
    const streak = await db
      .selectFrom("streak_weeks")
      .select(["outcome", count])
      .where("week_start", ">=", since)
      .where("closed_at", "is not", null)
      .groupBy("outcome")
      .execute();
    const imports = await db
      .selectFrom("recipes")
      .select([count, sql<number>`count(*) filter (where status = 'validated')`.as("validated")])
      .where("household_id", "is not", null)
      .where(inPeriod("created_at"))
      .executeTakeFirstOrThrow();
    const events = await db
      .selectFrom("events")
      .select([
        "name",
        sql<number>`count(*) filter (where ${inPeriod("created_at")})`.as("n"),
        sql<number>`count(*) filter (where ${inPrev("created_at")})`.as("prev"),
      ])
      .where(
        "name",
        "in",
        ENGAGEMENT_EVENTS.map(([name]) => name),
      )
      .where(sql<boolean>`${local("created_at")}::date >= ${prevSince}::date`)
      .groupBy("name")
      .execute();

    return {
      sessions: {
        done: Number(sessions.done),
        donePrev: Number(sessions.donePrev),
        started: Number(sessions.started),
        abandoned: Number(sessions.abandoned),
        households: Number(sessions.households),
        householdsPrev: Number(sessions.householdsPrev),
        medianMinutes: sessions.medianMinutes === null ? null : Number(sessions.medianMinutes),
        series: sessionSeries.map((r) => ({ key: r.key, n: Number(r.n) })),
        weekdays: sessionWeekdays.map((r) => ({ dow: Number(r.dow), n: Number(r.n) })),
        menus,
      },
      cooks: {
        total: Number(cooks.total),
        prev: Number(cooks.prev),
        distinct: Number(cooks.distinct),
        imported: Number(cooks.imported),
        catalog,
        series: cookSeries.map((r) => ({ key: r.key, n: Number(r.n) })),
        byKind: byKind.map((r) => ({ kind: r.kind, n: Number(r.n) })),
        byProtein: byProtein.map((r) => ({ protein: r.protein, n: Number(r.n) })),
        byOrigin: byOrigin.map((r) => ({ origin: r.origin as string, n: Number(r.n) })),
        top: topRecipes.map((r) => ({
          id: r.id,
          name: r.name ?? r.id,
          kind: r.kind,
          origin: r.origin,
          n: Number(r.n),
          households: Number(r.households),
        })),
      },
      ratings: {
        total: Number(ratingTotals.n),
        households: Number(ratingTotals.households),
        cookingHouseholds,
        liked: Number(ratingTotals.liked),
        refused: Number(ratingTotals.refused),
        kids: Number(ratingTotals.kids),
        tooLong: Number(ratingTotals.tooLong),
        opinions: opinions.map((o): RecipeOpinion => ({
          id: o.id,
          name: o.name ?? o.id,
          origin: o.origin,
          liked: Number(o.liked),
          kids: Number(o.kids),
          refused: Number(o.refused),
          tooLong: Number(o.tooLong),
          cookedBy: Number(o.cookedBy),
        })),
      },
      antigaspi: {
        saves: Number(saves.n),
        urgent: Number(saves.urgent),
        households: Number(saves.households),
        top: topSaved.map((r) => ({ label: r.label, n: Number(r.n) })),
      },
      streak: streak.map((r) => ({ outcome: r.outcome, n: Number(r.n) })),
      imports: { total: Number(imports.n), validated: Number(imports.validated) },
      events: events.map((e) => ({ name: e.name, n: Number(e.n), prev: Number(e.prev) })),
    };
  });
}
