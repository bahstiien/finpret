// Tests pgTAP sur le projet Supabase hébergé de développement (SUPABASE_DB_URL), sans Docker.
// Chaque fichier de test tourne dans sa propre session et se termine par un rollback ;
// seul 00_helpers laisse le schéma `tests` et l'extension pgtap, utiles aux exécutions suivantes.
// Usage : pnpm test:db
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnvLocal, requireEnv } from "./lib/env.mjs";
import { reportTap } from "./lib/pgtap.mjs";

loadEnvLocal();
const connectionString = requireEnv("SUPABASE_DB_URL");
const dir = join(process.cwd(), "supabase/tests/database");

let failures = 0;
for (const file of readdirSync(dir).sort()) {
  console.log(`\n# ${file}`);
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    failures += reportTap(await client.query(readFileSync(join(dir, file), "utf8")));
  } catch (error) {
    console.error(`ERREUR : ${error.message}`);
    failures++;
    await client.query("rollback").catch(() => {});
  } finally {
    await client.end();
  }
}

console.log(failures ? `\n${failures} échec(s)` : "\nTous les tests de base passent.");
process.exit(failures ? 1 : 0);
