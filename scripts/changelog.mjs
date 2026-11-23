// Écrit changelog.json : un déploiement réussi par entrée, avec les PR livrées depuis le précédent.
// Lancé par le job build du workflow Deploy (gh authentifié, historique git complet) ; lu par /admin/changelog.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { LOG_FORMAT, buildChangelog, parseLog } from "./lib/changelog.mjs";

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

// shortcut: 100 derniers déploiements réussis seulement, paginer si l'historique en compte plus.
const past = JSON.parse(
  run("gh", [
    "api",
    "repos/{owner}/{repo}/actions/workflows/deploy.yml/runs?status=success&per_page=100",
    "--jq",
    "[.workflow_runs[] | {sha: .head_sha, at: .updated_at, run: .id}]",
  ]),
).reverse();

// Le déploiement en cours n'a pas encore réussi : il entre dans la liste puisque l'image ne tourne que s'il aboutit.
const current = process.env.GITHUB_SHA ?? run("git", ["rev-parse", "HEAD"]).trim();
const runId = process.env.GITHUB_RUN_ID ? Number(process.env.GITHUB_RUN_ID) : null;
const deploys = [
  ...past.filter((d) => d.run !== runId),
  { sha: current, at: new Date().toISOString(), run: runId },
];

const changelog = buildChangelog(deploys, (from, to) => {
  try {
    return parseLog(run("git", ["log", "--first-parent", `--format=${LOG_FORMAT}`, `${from}..${to}`]));
  } catch {
    return null; // commit absent (branche supprimée, historique réécrit)
  }
});

writeFileSync("changelog.json", JSON.stringify(changelog, null, 2));
console.log(`changelog.json : ${changelog.length} déploiements.`);
