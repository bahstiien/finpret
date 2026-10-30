// Applique les migrations SQL de db/migrations/ à DATABASE_URL, dans l'ordre, une transaction par fichier.
// Les versions appliquées sont tenues dans public.schema_migrations.
// Usage : pnpm db:migrate | pnpm db:migrate --dry (liste ce qui serait appliqué)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnvLocal, pgSsl, requireEnv } from "./lib/env.mjs";

loadEnvLocal();
const connectionString = requireEnv("DATABASE_URL");
const dry = process.argv.includes("--dry");
const dir = join(process.cwd(), "db/migrations");

const client = new pg.Client({ connectionString, ssl: pgSsl(connectionString) });
await client.connect();
await client.query(`
  create table if not exists public.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
`);
const { rows } = await client.query("select version from public.schema_migrations");
const applied = new Set(rows.map((r) => r.version));

const pending = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => !applied.has(f.split("_")[0]));

if (!pending.length) console.log("Base à jour.");
for (const file of pending) {
  if (dry) {
    console.log(`à appliquer : ${file}`);
    continue;
  }
  try {
    await client.query("begin");
    await client.query(readFileSync(join(dir, file), "utf8"));
    await client.query("insert into public.schema_migrations (version) values ($1)", [file.split("_")[0]]);
    await client.query("commit");
    console.log(`migration ${file}`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error(`ÉCHEC de la migration ${file} : ${error.message}`);
    await client.end();
    process.exit(1);
  }
}
await client.end();
