/**
 * Génère `src/components/progress/world-map-data.ts` : la mappemonde du passeport des saveurs.
 * Fond Natural Earth 1:110m (domaine public, paquet world-atlas), projection Equal Earth, sans l'Antarctique.
 * « rest » = les pays hors passeport fusionnés ; « countries » = un tracé par pays candidat (code ISO alpha-2).
 *
 * Outils hors dépendances du projet : dans un dossier vide,
 *   npm i d3-geo@3.1.1 topojson-client@3.1.0 world-atlas@2.0.2
 * puis copier ce script dans ce dossier et lancer : node build-world-map.mjs <chemin du fichier .ts à écrire>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature, merge } from "topojson-client";

const require = createRequire(import.meta.url);
const world = JSON.parse(readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8"));

// Pays du catalogue et cuisines probables : ISO alpha-2 → ISO numérique (identifiants de world-atlas).
const CANDIDATES = {
  fr: "250", it: "380", es: "724", gr: "300", pt: "620", gb: "826", be: "056", ch: "756", hu: "348", de: "276",
  pl: "616", se: "752", ma: "504", tn: "788", dz: "012", sn: "686", et: "231", lb: "422", tr: "792", ir: "364",
  in: "356", pk: "586", th: "764", vn: "704", jp: "392", cn: "156", kr: "410", id: "360", ph: "608", mx: "484",
  us: "840", ca: "124", br: "076", pe: "604", ar: "032",
};
const W = 500;
const objects = world.objects.countries;
const geoms = objects.geometries.filter((g) => g.id !== "010");
const land = feature(world, { type: "GeometryCollection", geometries: geoms });
const projection = geoEqualEarth().fitWidth(W, land);
const raw = geoPath(projection);

/** Tracé compact : coordonnées entières, commandes relatives, segments nuls retirés (comme la maquette). */
function compact(d) {
  if (!d) return "";
  let out = "";
  let px = 0;
  let py = 0;
  // Après « z », le point courant revient au début du sous-tracé : les « m » relatifs partent de là.
  let sx = 0;
  let sy = 0;
  for (const part of d.match(/[MLZ][^MLZ]*/g) ?? []) {
    const cmd = part[0];
    if (cmd === "Z") {
      out += "z";
      px = sx;
      py = sy;
      continue;
    }
    const nums = part.slice(1).split(/[ ,]+/).filter(Boolean).map(Number);
    let seg = "";
    for (let i = 0; i < nums.length; i += 2) {
      const x = Math.round(nums[i]);
      const y = Math.round(nums[i + 1]);
      const dx = x - px;
      const dy = y - py;
      if (cmd === "L" && dx === 0 && dy === 0) continue;
      seg += (seg ? " " : "") + `${dx} ${dy}`.replace(/ -/g, "-");
      px = x;
      py = y;
    }
    if (cmd === "M") {
      sx = px;
      sy = py;
    }
    if (seg) out += (cmd === "M" ? "m" : "l") + seg;
  }
  // Après « m » ou « l », les paires suivantes sont des « l » implicites.
  return out.replace(/l(?=z)/g, "").replace(/(\d)l(-)/g, "$1$2").replace(/(\d)l(\d)/g, "$1 $2");
}
const path = Object.assign((f) => compact(raw(f)), { bounds: (f) => raw.bounds(f), centroid: (f) => raw.centroid(f), area: (f) => raw.area(f) });
const [[, y0], [, y1]] = path.bounds(land);
const H = Math.ceil(y1 - y0);
projection.translate([projection.translate()[0], projection.translate()[1] - y0]);

const byId = new Map(geoms.map((g) => [g.id, g]));
const listed = new Set(Object.values(CANDIDATES));
const rest = path(merge(world, geoms.filter((g) => !listed.has(g.id))));
const countries = {};
for (const [code, id] of Object.entries(CANDIDATES)) {
  const g = byId.get(id);
  if (!g) throw new Error(`pays absent de world-atlas : ${code} (${id})`);
  const f = feature(world, g);
  const [cx, cy] = path.centroid(f);
  countries[code] = { d: path(f), cx: Math.round(cx * 10) / 10, cy: Math.round(cy * 10) / 10, a: Math.round(path.area(f)) };
}

const out = `// Fichier généré par scripts/build-world-map.mjs : ne pas modifier à la main.
// Natural Earth 1:110m (domaine public, via world-atlas), projection Equal Earth, sans l'Antarctique.

export const WORLD_MAP = {
  w: ${W},
  h: ${H},
  rest: ${JSON.stringify(rest)},
  countries: ${JSON.stringify(countries)} as Record<string, { d: string; cx: number; cy: number; a: number }>,
};
`;
writeFileSync(process.argv[2], out);
console.log(`écrit ${process.argv[2]} : ${W}×${H}, ${(out.length / 1024).toFixed(1)} Ko`);
