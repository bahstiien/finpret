// Génère src/server/db.types.ts (types Kysely) depuis le schéma de DATABASE_URL, migrations appliquées.
// Les colonnes texte bornées par un `check (… in (…))` reçoivent ensuite leur union de valeurs
// (scripts/db-types-overrides.json, à compléter quand une migration en ajoute une).
// Usage : pnpm db:types
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, requireEnv } from "./lib/env.mjs";

loadEnvLocal();
const url = requireEnv("DATABASE_URL");
const OUT = "src/server/db.types.ts";

// Point d'entrée Node direct, sans shell : un mot de passe contenant `&` ou `%` serait sinon découpé par cmd.exe sous Windows.
const CLI = fileURLToPath(new URL("../node_modules/kysely-codegen/dist/cli/bin.js", import.meta.url));

const result = spawnSync(
  process.execPath,
  [
    CLI,
    "--dialect=postgres",
    `--url=${url}`,
    `--out-file=${OUT}`,
    "--default-schema=public",
    "--include-pattern=(public|auth).*",
    "--exclude-pattern=public.schema_migrations",
    // Mêmes formats que le pool (src/server/db.ts) : dates et horodatages en texte, nombres.
    "--date-parser=string",
    "--numeric-parser=number",
    '--type-mapping={"timestamptz":"string","timestamp":"string","int8":"number"}',
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);

const overrides = JSON.parse(readFileSync(new URL("./db-types-overrides.json", import.meta.url), "utf8"));
const pascal = (table) => table.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
let source = readFileSync(OUT, "utf8");
for (const [key, union] of Object.entries(overrides)) {
  const [table, column] = key.split(".");
  const block = new RegExp(`(export interface ${pascal(table)} \\{[^}]*?\\n  ${column}: )([^;]+);`);
  const match = source.match(block);
  if (!match) {
    console.error(`Colonne introuvable pour la surcharge ${key}.`);
    process.exit(1);
  }
  const typed = match[2].startsWith("Generated<") ? `Generated<${union}>` : union;
  source = source.replace(block, `$1${typed};`);
}
writeFileSync(OUT, source);
console.log(`${Object.keys(overrides).length} colonnes typées par leurs valeurs autorisées.`);
