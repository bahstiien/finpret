// Importe seed/*.json dans la base (catalogue global), en une transaction.
// Idempotent : met à jour l'existant, ajoute le nouveau, retire du catalogue global ce qui n'est plus dans le seed.
// Ne touche jamais aux recettes privées des foyers (household_id non nul).
// Usage : pnpm seed  (SUPABASE_DB_URL dans .env.local)   |   pnpm seed --dry-run
import pg from "pg";
import { buildCatalogRows, validateSeed } from "../src/engine/catalog";
import { rawSeed } from "../src/engine/catalog/seed-files";
import { loadEnvLocal, requireEnv } from "./lib/env.mjs";

const dryRun = process.argv.includes("--dry-run");

const { seed, issues, warnings } = validateSeed(rawSeed);
if (!seed || issues.length) {
  console.error(`Seed invalide (${issues.length} problème(s)) :\n- ${issues.join("\n- ")}`);
  process.exit(1);
}
for (const warning of warnings) console.warn(`avertissement : ${warning}`);
const rows = buildCatalogRows(seed);

const summary = Object.entries({
  rayons: rows.aisles.length,
  ingrédients: rows.ingredients.length,
  contenants: rows.packs.length,
  recettes: rows.recipes.length,
})
  .map(([k, v]) => `${v} ${k}`)
  .join(", ");

if (dryRun) {
  console.log(`Seed valide : ${summary}. Rien n'est écrit (--dry-run).`);
  process.exit(0);
}

loadEnvLocal();
const client = new pg.Client({
  connectionString: requireEnv("SUPABASE_DB_URL"),
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query("begin");

  await client.query(
    `insert into public.aisles (key, label, position)
     select key, label, position from jsonb_to_recordset($1::jsonb) as x(key text, label text, position smallint)
     on conflict (key) do update set label = excluded.label, position = excluded.position`,
    [JSON.stringify(rows.aisles)],
  );

  await client.query(
    `insert into public.ingredients (key, label, unit, aisle, forms, half, allergens, seasonal)
     select key, label, unit, aisle, forms, half, allergens, seasonal
     from jsonb_to_recordset($1::jsonb)
       as x(key text, label text, unit text, aisle text, forms jsonb, half boolean, allergens text[], seasonal boolean)
     on conflict (key) do update set label = excluded.label, unit = excluded.unit, aisle = excluded.aisle,
       forms = excluded.forms, half = excluded.half, allergens = excluded.allergens, seasonal = excluded.seasonal`,
    [JSON.stringify(rows.ingredients)],
  );

  await client.query(
    `insert into public.packs (ingredient_key, sizes, label, tolerance)
     select ingredient_key, sizes, label, tolerance
     from jsonb_to_recordset($1::jsonb) as x(ingredient_key text, sizes int[], label text, tolerance numeric)
     on conflict (ingredient_key) do update
       set sizes = excluded.sizes, label = excluded.label, tolerance = excluded.tolerance`,
    [JSON.stringify(rows.packs)],
  );
  await client.query(`delete from public.packs where not (ingredient_key = any($1::text[]))`, [
    rows.packs.map((p) => p.ingredient_key),
  ]);

  // Une recette privée portant le même identifiant ne doit jamais être écrasée.
  const { rows: clashes } = await client.query<{ id: string }>(
    `select id from public.recipes where household_id is not null and id = any($1::text[])`,
    [rows.recipes.map((r) => r.id)],
  );
  if (clashes.length)
    throw new Error(`Identifiants déjà pris par des recettes privées : ${clashes.map((c) => c.id)}`);

  await client.query(
    `insert into public.recipes (id, kind, data, origin, protein, months, diet_tags, allergens, is_active)
     select id, kind, data, origin, protein, months, diet_tags, allergens, true
     from jsonb_to_recordset($1::jsonb)
       as x(id text, kind text, data jsonb, origin text, protein text, months smallint[], diet_tags text[], allergens text[])
     on conflict (id) do update set kind = excluded.kind, data = excluded.data, origin = excluded.origin,
       protein = excluded.protein, months = excluded.months, diet_tags = excluded.diet_tags,
       allergens = excluded.allergens, is_active = true
     where public.recipes.household_id is null`,
    [JSON.stringify(rows.recipes)],
  );
  // Retirée du seed : désactivée plutôt que supprimée (elle peut figurer dans l'historique des semaines).
  const { rowCount: retired } = await client.query(
    `update public.recipes set is_active = false
     where household_id is null and is_active and not (id = any($1::text[]))`,
    [rows.recipes.map((r) => r.id)],
  );

  await client.query("commit");
  console.log(
    `Catalogue importé : ${summary}.${retired ? ` ${retired} recette(s) retirée(s) du seed désactivée(s).` : ""}`,
  );
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`Import annulé : ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
