// Commandes de la CLI Supabase contre le projet hébergé, avec les valeurs de .env.local.
// Usage : pnpm db:push | pnpm db:push:dry | pnpm db:types
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, requireEnv } from "./lib/env.mjs";

loadEnvLocal();
const command = process.argv[2];

// Appel direct du point d'entrée Node de la CLI, sans shell : un mot de passe contenant `&`
// ou `%` serait sinon découpé par cmd.exe sous Windows.
const CLI = fileURLToPath(new URL("../node_modules/supabase/dist/supabase.js", import.meta.url));

function supabase(args, options = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    stdio: options.capture ? ["inherit", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}

/** Ré-encode l'utilisateur et le mot de passe : la CLI exige une URL entièrement encodée. */
function encodedDbUrl(raw) {
  const scheme = raw.indexOf("://") + 3;
  const at = raw.lastIndexOf("@");
  const [user, ...rest] = raw.slice(scheme, at).split(":");
  const encode = (s) => encodeURIComponent(safeDecode(s));
  return `${raw.slice(0, scheme)}${encode(user)}:${encode(rest.join(":"))}${raw.slice(at)}`;
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

switch (command) {
  case "push":
  case "push:dry": {
    const dbUrl = encodedDbUrl(requireEnv("SUPABASE_DB_URL"));
    supabase(["db", "push", "--db-url", dbUrl, ...(command === "push:dry" ? ["--dry-run"] : [])]);
    break;
  }
  case "types": {
    requireEnv("SUPABASE_ACCESS_TOKEN");
    const ref = new URL(requireEnv("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];
    const types = supabase(["gen", "types", "typescript", "--project-id", ref, "--schema", "public"], {
      capture: true,
    });
    writeFileSync("src/lib/supabase/database.types.ts", types);
    console.log("src/lib/supabase/database.types.ts régénéré.");
    break;
  }
  default:
    console.error("Commande inconnue : push, push:dry ou types.");
    process.exit(1);
}
