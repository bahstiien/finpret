// Génère src/server/db.types.ts (types Kysely) depuis le schéma de DATABASE_URL, migrations appliquées.
// Usage : pnpm db:types:pg
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, requireEnv } from "./lib/env.mjs";

loadEnvLocal();
const url = requireEnv("DATABASE_URL");

// Point d'entrée Node direct, sans shell : même raison que supabase-remote.mjs (caractères spéciaux sous Windows).
const CLI = fileURLToPath(new URL("../node_modules/kysely-codegen/dist/cli/bin.js", import.meta.url));

const result = spawnSync(
  process.execPath,
  [
    CLI,
    "--dialect=postgres",
    `--url=${url}`,
    "--out-file=src/server/db.types.ts",
    "--default-schema=public",
    "--include-pattern=(public|auth).*",
    "--exclude-pattern=public.schema_migrations",
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
