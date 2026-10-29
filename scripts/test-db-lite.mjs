// Vérification rapide sans Docker : applique les migrations et joue les tests pgTAP sur PGlite
// (Postgres en WebAssembly). Les rôles et le schéma auth viennent de la migration de compatibilité.
// Usage : pnpm test:db:lite
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgtap } from "@electric-sql/pglite-pgtap";
import { reportTap } from "./lib/pgtap.mjs";

const root = process.cwd();
const db = await PGlite.create({ extensions: { pgcrypto, pg_trgm, unaccent, pgtap } });

const migrations = join(root, "supabase/migrations");
for (const file of readdirSync(migrations).sort()) {
  try {
    await db.exec(readFileSync(join(migrations, file), "utf8"));
    console.log(`migration ${file}`);
  } catch (error) {
    console.error(`ÉCHEC de la migration ${file} : ${error.message}`);
    process.exit(1);
  }
}

const tests = join(root, "supabase/tests/database");
let failures = 0;
for (const file of readdirSync(tests).sort()) {
  console.log(`\n# ${file}`);
  // pg_prove ouvre une session par fichier : on repart d'un état pgTAP vierge.
  await db.exec("reset role; discard temp;");
  try {
    failures += reportTap(await db.exec(readFileSync(join(tests, file), "utf8")));
  } catch (error) {
    console.error(`ERREUR : ${error.message}`);
    failures++;
    await db.exec("rollback").catch(() => {});
  }
}

console.log(failures ? `\n${failures} échec(s)` : "\nTous les tests de base passent.");
process.exit(failures ? 1 : 0);
