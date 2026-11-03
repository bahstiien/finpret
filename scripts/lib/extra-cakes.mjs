// Ajoute 103 goûters au seed (150 au total) : 50 gâteaux, tartes et crumbles, 25 biscuits, 12 brioches, 16 crêpes et gaufres.
// Les macros par part sont calculées depuis une table nutritionnelle approximative (mains-lib.mjs). Idempotent.
// Usage : node scripts/lib/extra-cakes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import autres from "./cakes-autres.mjs";
import gateaux from "./cakes-gateaux.mjs";
import { stats } from "./cakes-lib.mjs";

const path = fileURLToPath(new URL("../../seed/cakes.json", import.meta.url));
const fresh = [...gateaux, ...autres];
const ids = new Set(fresh.map((r) => r.id));
if (ids.size !== fresh.length) throw new Error("identifiant en double dans les nouveaux goûters");
// Idempotent : les goûters déjà ajoutés par ce script sont remplacés, les autres sont conservés.
const data = JSON.parse(readFileSync(path, "utf8")).filter((r) => !ids.has(r.id));
const names = new Set(data.map((r) => r.n.toLowerCase()));
for (const r of fresh) if (names.has(r.n.toLowerCase())) throw new Error(`nom déjà pris : ${r.n}`);
writeFileSync(path, `${JSON.stringify([...data, ...fresh], null, 1)}\n`);
const byType = Object.groupBy(fresh, (r) => r.t);
console.log(`cakes.json : ${data.length + fresh.length} goûters (+${fresh.length} : ${Object.entries(byType).map(([t, l]) => `${t} ${l.length}`).join(", ")})`);
for (const w of stats.warnings) console.warn(`avertissement : ${w}`);
