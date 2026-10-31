// Ajoute 150 plats au seed : 50 végétariens, 50 hyper protéinés (≥ 40 g de protéines par portion), 50 à protéines animales.
// Les macros sont calculées depuis une table nutritionnelle approximative (mains-lib.mjs). Idempotent.
// Usage : node scripts/lib/extra-mains.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import animal from "./mains-animal.mjs";
import hp from "./mains-hp.mjs";
import { stats } from "./mains-lib.mjs";
import veg from "./mains-veg.mjs";

const path = fileURLToPath(new URL("../../seed/mains.json", import.meta.url));
const fresh = [...veg, ...hp, ...animal];
const ids = new Set(fresh.map((r) => r.id));
if (ids.size !== fresh.length) throw new Error("identifiant en double dans les nouveaux plats");
// Idempotent : les plats déjà ajoutés par ce script sont remplacés, les autres sont conservés.
const data = JSON.parse(readFileSync(path, "utf8")).filter((r) => !ids.has(r.id));
const names = new Set(data.map((r) => r.n.toLowerCase()));
for (const r of fresh) if (names.has(r.n.toLowerCase())) throw new Error(`nom déjà pris : ${r.n}`);
writeFileSync(path, `${JSON.stringify([...data, ...fresh], null, 1)}\n`);
console.log(`mains.json : ${fresh.length} plats (végé ${veg.length}, hyper protéinés ${hp.length}, animal ${animal.length})`);
for (const w of stats.warnings) console.warn(`avertissement : ${w}`);
