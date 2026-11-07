// Empaquette scripts/seed.ts (et le catalogue seed/*.json) en un seul fichier pour l'image de production :
// le Deploy l'exécute après les migrations (`docker compose run --rm migrate node scripts/seed.mjs`).
// `pg` reste externe : il est déjà dans les dépendances du serveur autonome, comme pour migrate.mjs.
// esbuild vient de tsx (dépendance de développement), sans dépendance supplémentaire.
// Usage : node scripts/build-seed.mjs  → .next-build/scripts/seed.mjs
import { createRequire } from "node:module";

const esbuild = createRequire(createRequire(import.meta.url).resolve("tsx/package.json"))("esbuild");

await esbuild.build({
  entryPoints: ["scripts/seed.ts"],
  outfile: ".next-build/scripts/seed.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: ["pg"],
  tsconfig: "tsconfig.json",
  logLevel: "warning",
});
console.log("seed empaqueté : .next-build/scripts/seed.mjs");
