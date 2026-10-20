// Rattrapage du passeport à la mise en ligne (SPEC_PROGRES §4.3) : pour chaque semaine dont la session a été terminée
// avant le déploiement (événement `session_done`), inscrit les recettes du plan dans `recipe_cooks` (backfilled) et les
// tampons correspondants, déjà vus : aucun palier ni tampon n'est célébré. Idempotent. `done_at` est repris de l'événement.
// Usage : pnpm backfill:progress  (SUPABASE_DB_URL dans .env.local)   |   pnpm backfill:progress --dry-run (annule)
import pg from "pg";
import { batchCooks, simpleCooks } from "../src/engine/cooks";
import { type CookRecord, newAchievements } from "../src/engine/passport";
import type { WeekPlan } from "../src/engine/types";
import { loadEnvLocal, pgSsl, requireEnv } from "./lib/env.mjs";

const dryRun = process.argv.includes("--dry-run");
loadEnvLocal();
const connectionString = requireEnv("SUPABASE_DB_URL");
const client = new pg.Client({ connectionString, ssl: pgSsl(connectionString) });
await client.connect();

const localDate = (instant: Date, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);

try {
  await client.query("begin");
  const { rows: weeks } = await client.query<{
    week_id: string;
    household_id: string;
    start_date: string;
    plan: WeekPlan;
    tz: string;
    done_at: Date | null;
    event_at: Date;
  }>(
    `select w.id as week_id, w.household_id, w.start_date::text, w.plan, h.timezone as tz, s.done_at,
            min(e.created_at) as event_at
       from public.events e
       join public.weeks w on w.id::text = e.props ->> 'key'
       join public.households h on h.id = w.household_id
       left join public.sessions s on s.week_id = w.id
      where e.name = 'session_done'
      group by w.id, h.timezone, s.done_at`,
  );

  const households = new Set<string>();
  let cooks = 0;
  for (const w of weeks) {
    households.add(w.household_id);
    if (!w.done_at) {
      await client.query("update public.sessions set done_at = $2 where week_id = $1 and done_at is null", [
        w.week_id,
        w.event_at,
      ]);
    }
    const sessionDate = localDate(w.done_at ?? w.event_at, w.tz);
    const today = localDate(new Date(), w.tz);
    const planned = [...batchCooks(w.plan, sessionDate), ...simpleCooks(w.plan, w.start_date, today)];
    for (const c of planned) {
      const r = await client.query(
        `insert into public.recipe_cooks (household_id, recipe_id, week_id, kind, cooked_on, backfilled)
         select $1, $2, $3, $4, $5, true where exists (select 1 from public.recipes where id = $2)
         on conflict (household_id, recipe_id, week_id) do nothing`,
        [w.household_id, c.recipeId, w.week_id, c.kind, c.cookedOn],
      );
      cooks += r.rowCount ?? 0;
    }
  }

  let stamps = 0;
  for (const household of households) {
    const { rows } = await client.query<{
      recipe_id: string;
      kind: CookRecord["kind"];
      cooked_on: string;
      origin: string | null;
      months: number[] | null;
      global: boolean;
      sv: { m: number[] }[] | null;
    }>(
      `select c.recipe_id, c.kind, c.cooked_on::text, r.origin, r.months, r.household_id is null as global, r.data -> 'sv' as sv
         from public.recipe_cooks c join public.recipes r on r.id = c.recipe_id where c.household_id = $1`,
      [household],
    );
    const records: CookRecord[] = rows.map((r) => ({
      recipeId: r.recipe_id,
      kind: r.kind,
      cookedOn: r.cooked_on,
      origin: r.origin,
      isGlobal: r.global,
      ...(r.months ? { months: r.months } : {}),
      ...(r.sv ? { variantMonths: r.sv.map((v) => v.m) } : {}),
    }));
    const { rows: existing } = await client.query<{ kind: string; key: string }>(
      "select kind, key from public.achievements where household_id = $1",
      [household],
    );
    for (const a of newAchievements(records, new Set(existing.map((e) => `${e.kind}:${e.key}`)))) {
      await client.query(
        `insert into public.achievements (household_id, kind, key, seen_at) values ($1, $2, $3, now())
         on conflict do nothing`,
        [household, a.kind, a.key],
      );
      stamps += 1;
    }
  }

  console.log(
    `${weeks.length} semaine(s), ${households.size} foyer(s), ${cooks} recette(s) inscrite(s), ${stamps} tampon(s) (déjà vus).`,
  );
  await client.query(dryRun ? "rollback" : "commit");
  if (dryRun) console.log("--dry-run : rien n'est écrit.");
} catch (error) {
  await client.query("rollback");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
