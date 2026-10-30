// Base PostgreSQL de développement, sans Docker : un cluster dans .pgdata/ lancé avec les binaires
// installés sur le poste (PostgreSQL pour Windows, ou PG_BIN). Accès local sans mot de passe (trust).
// DATABASE_URL correspondante : postgresql://postgres@localhost:54329/finpret
// Usage : pnpm db:local start | stop | status | reset
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const PORT = "54329";
const DB = "finpret";
const data = resolve(".pgdata");

function binDir() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const base = "C:\\Program Files\\PostgreSQL";
  if (existsSync(base)) {
    const latest = readdirSync(base)
      .filter((v) => existsSync(join(base, v, "bin", "pg_ctl.exe")))
      .sort((a, b) => Number(b) - Number(a))[0];
    if (latest) return join(base, latest, "bin");
  }
  return ""; // binaires dans le PATH (Linux, macOS)
}

function run(tool, args, { allowFail = false, detached = false } = {}) {
  const dir = binDir();
  // Le serveur lancé par pg_ctl hérite des sorties : sans "ignore", l'appelant attendrait sa fin.
  const result = spawnSync(dir ? join(dir, tool) : tool, args, { stdio: detached ? "ignore" : "inherit" });
  if (result.error) {
    console.error(`${tool} introuvable : installe PostgreSQL ou renseigne PG_BIN.`);
    process.exit(1);
  }
  if (result.status !== 0 && !allowFail) process.exit(result.status ?? 1);
  return result.status;
}

function start() {
  if (!existsSync(data)) {
    run("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  }
  if (run("pg_ctl", ["status", "-D", data], { allowFail: true }) !== 0) {
    run("pg_ctl", ["start", "-D", data, "-l", join(data, "server.log"), "-w", "-o", `-p ${PORT}`], { detached: true });
  }
  const exists = spawnSync(
    join(binDir(), "psql"),
    ["-h", "localhost", "-p", PORT, "-U", "postgres", "-tAc", `select 1 from pg_database where datname = '${DB}'`],
    { encoding: "utf8" },
  ).stdout.trim();
  if (exists !== "1") run("createdb", ["-h", "localhost", "-p", PORT, "-U", "postgres", DB]);
  console.log(`Base prête : postgresql://postgres@localhost:${PORT}/${DB}`);
}

switch (process.argv[2]) {
  case "start":
    start();
    break;
  case "stop":
    run("pg_ctl", ["stop", "-D", data, "-m", "fast"]);
    break;
  case "status":
    run("pg_ctl", ["status", "-D", data], { allowFail: true });
    break;
  case "reset":
    if (existsSync(data)) {
      run("pg_ctl", ["stop", "-D", data, "-m", "fast"], { allowFail: true });
      rmSync(data, { recursive: true, force: true });
    }
    start();
    break;
  default:
    console.error("Usage : pnpm db:local start | stop | status | reset");
    process.exit(1);
}
