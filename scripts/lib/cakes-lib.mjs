// Outil pour rédiger des goûters du seed : macros par part calculées depuis la table nutritionnelle
// de mains-lib.mjs, difficulté estimée comme estimateDifficulty (src/engine/catalog/difficulty.ts).
import { N } from "./mains-lib.mjs";

const PART_COUNT = /^(\d+)\s/;

function perPart(ing, parts) {
  const count = Number(PART_COUNT.exec(parts)?.[1]);
  if (!count) throw new Error(`nombre de parts illisible : ${parts}`);
  const t = [0, 0, 0, 0];
  for (const [k, q] of Object.entries(ing)) {
    const n = N[k];
    if (!n) throw new Error(`pas de valeurs nutritionnelles pour ${k}`);
    for (let i = 0; i < 4; i++) t[i] += (q / n[0]) * n[i + 1];
  }
  return t.map((v) => Math.round(v / count));
}

/** Même barème que estimateDifficulty pour un goûter : pâte levée = 4, sinon durée active (avant « dont » / « et »). */
function difficulty(tm) {
  if (/pousse/.test(tm)) return 4;
  const head = tm.split(/ dont | et /)[0];
  const hours = /(\d+)\s*h/.exec(head);
  const minutes = /(\d+)\s*min/.exec(head);
  const active = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  return active <= 30 ? 1 : active <= 50 ? 2 : active <= 70 ? 3 : 4;
}

export const stats = { warnings: [] };

/** G(id, nom, type, durée, parts, enfant, ingrédients, étapes, mois?) */
export function G(id, n, t, tm, parts, kid, ing, steps, months) {
  const text = [...steps, kid].join(" ");
  for (const k of Object.keys(ing)) {
    if (!text.includes(`{${k}}`)) throw new Error(`${id} : ingrédient ${k} absent des étapes`);
  }
  const m = perPart(ing, parts);
  if (m[0] < 40 || m[0] > 420) stats.warnings.push(`${id} : ${m[0]} kcal par part`);
  return { id, n, t, tm, parts, ...(months ? { months } : {}), m, diff: difficulty(tm), kid, ing, steps };
}

const range = (a, b) => (a <= b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [...range(a, 12), ...range(1, b)]);
/** Mois des fruits frais (les fruits du seed ne sont pas soumis à la saisonnalité automatique). */
export const M = {
  fraises: range(5, 7), rhubarbe: range(4, 6), cerises: range(6, 7), abricots: range(6, 8), peche: range(6, 9),
  prunes: range(8, 9), figues: range(8, 10), pomme: range(9, 4), poire: range(9, 2), courgette: range(5, 10),
  potimarron: range(9, 12), patatedouce: range(9, 3), betterave: range(9, 3), chataigne: range(10, 1),
  agrumes: range(11, 3), noel: [11, 12, 1], rois: [12, 1], paques: [3, 4],
};
