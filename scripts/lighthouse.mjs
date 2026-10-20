// Audit Lighthouse (M11) des pages publiques sur le build de production.
// Usage : pnpm build && pnpm audit:lighthouse (Lighthouse via npx ; CHROME_PATH : Chrome ou le Chromium de Playwright)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PORT = 3300;
const PAGES = ["/", "/login", "/associations", "/associations/comment-ca-marche"];
const OUT = "lighthouse-report";

const server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], {
  stdio: "ignore",
});
const stop = () => server.kill();
process.on("exit", stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return;
    } catch {
      // Pas encore prêt.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Le serveur ne démarre pas.");
}

await waitForServer();
mkdirSync(OUT, { recursive: true });
const results = [];
for (const page of PAGES) {
  for (const preset of ["mobile", "desktop"]) {
    const file = path.join(OUT, `${page === "/" ? "accueil" : page.slice(1).replaceAll("/", "-")}-${preset}.json`);
    const args = [
      "--yes",
      "lighthouse@12.8.2",
      `http://localhost:${PORT}${page}`,
      "--quiet",
      "--output=json",
      `--output-path=${file}`,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless=new --no-sandbox",
      ...(preset === "desktop" ? ["--preset=desktop"] : []),
    ];
    const run = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
    if (run.status !== 0) throw new Error(`Lighthouse a échoué pour ${page}`);
    const report = JSON.parse(readFileSync(file, "utf8"));
    const scores = Object.fromEntries(Object.entries(report.categories).map(([k, c]) => [k, Math.round(c.score * 100)]));
    results.push({ page, preset, ...scores });
  }
}
stop();
console.table(results);
// Seuils : accessibilité ≥ 90 partout ; landing /associations : SEO ≥ 95, performance ≥ 90, accessibilité ≥ 95
// (SPEC_JANVIER §8 bis) ; autres pages publiques : SEO ≥ 90.
const failing = results.filter((r) => {
  if (r.accessibility < 90) return true;
  if (r.page === "/associations") return r.seo < 95 || r.performance < 90 || r.accessibility < 95;
  if (r.page.startsWith("/associations")) return r.seo < 90;
  return false;
});
if (failing.length) {
  console.error("Seuils Lighthouse non atteints :", failing);
  process.exit(1);
}
