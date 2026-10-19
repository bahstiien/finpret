// Vérification rapide sans Docker : applique les migrations et joue les tests pgTAP sur PGlite
// (Postgres en WebAssembly), avec un stub minimal de ce que Supabase fournit (rôles, schéma auth).
// La référence reste `pnpm exec supabase test db`, jouée en CI sur le vrai Supabase.
// Usage : pnpm test:db:lite
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgtap } from "@electric-sql/pglite-pgtap";

const root = process.cwd();
const db = await PGlite.create({ extensions: { pgcrypto, pg_trgm, unaccent, pgtap } });

// Ce que Supabase met en place avant les migrations du projet.
await db.exec(`
  create schema extensions;
  set search_path = "$user", public, extensions;
  create extension pgcrypto with schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key, instance_id uuid, aud text, role text, email text,
    raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;
`);

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
    const results = await db.exec(readFileSync(join(tests, file), "utf8"));
    for (const { rows } of results) {
      for (const row of rows) {
        const line = Object.values(row)[0];
        if (typeof line !== "string" || !/^(not ok|ok|1\.\.|#)/.test(line.trim())) continue;
        console.log(line);
        if (line.startsWith("not ok") || line.includes("Looks like")) failures++;
      }
    }
  } catch (error) {
    console.error(`ERREUR : ${error.message}`);
    failures++;
    await db.exec("rollback").catch(() => {});
  }
}

console.log(failures ? `\n${failures} échec(s)` : "\nTous les tests de base passent.");
process.exit(failures ? 1 : 0);
