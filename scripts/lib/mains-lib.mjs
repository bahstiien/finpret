// Outils pour rédiger des plats du seed : macros calculées depuis une table nutritionnelle approximative,
// mois déduits des légumes de saison, protéine déduite des ingrédients.
// Valeurs : [quantité de référence, kcal, protéines g, glucides g, lipides g] ; g/ml → pour 100, sinon par unité du seed.
// Féculents et légumineuses : poids sec. Estimations courantes (CIQUAL arrondi), pas des mesures.
const N = {
  poulet: [100, 120, 23, 0, 2.5], boeuf: [100, 130, 21, 0, 5], dinde: [100, 110, 23, 0, 2], jambon: [1, 50, 9, 0.3, 1.3],
  oeufs: [1, 75, 6.5, 0.5, 5], feta: [100, 265, 14, 1, 21], emmental: [100, 380, 28, 0, 29], parmesan: [100, 400, 36, 0, 28],
  skyr: [100, 62, 11, 4, 0.2], fromageblanc: [100, 60, 8, 4, 1.5], yaourt: [1, 70, 5, 8, 2], cottage: [100, 90, 11, 3, 4],
  mozzarella: [100, 250, 18, 1, 19], ricotta: [100, 150, 11, 3, 10], patesfraiches: [100, 280, 11, 53, 2], galette: [1, 120, 4, 22, 2],
  pain: [1, 85, 3, 16, 1], painmie: [1, 80, 3, 14, 1.5], salade: [1, 30, 2, 4, 0.5], tortilla: [1, 140, 4, 24, 3],
  haricotsblancs: [1, 240, 16, 38, 1], bouillon: [1, 10, 0.5, 1, 0.5], patebrisee: [1, 1050, 13, 100, 62], gnocchis: [100, 150, 4, 32, 1],
  courgette: [1, 40, 3, 6, 0.8], banane: [1, 100, 1.2, 22, 0.3], citron: [1, 30, 1, 6, 0.3], poivron: [1, 50, 2, 9, 0.5],
  carotte: [1, 35, 0.8, 7, 0.2], epinards: [100, 25, 3, 1, 0.5], pommedeterre: [100, 80, 2, 17, 0.1], butternut: [100, 45, 1, 10, 0.1],
  choufleur: [100, 25, 2, 3, 0.3], brocoli: [100, 35, 3, 4, 0.4], champignons: [100, 22, 3, 1, 0.3], poireau: [1, 50, 2.5, 8, 0.4],
  persil: [1, 10, 1, 1, 0.2], gingembre: [1, 10, 0.3, 2, 0.1], edamame: [100, 120, 12, 8, 5], lentillescorail: [100, 340, 25, 50, 1.5],
  lentillesvertes: [100, 330, 25, 50, 1.5], poischiches: [1, 300, 17, 45, 5], haricotsrouges: [1, 240, 16, 38, 1], tomates: [1, 50, 2.5, 8, 0.5],
  thon: [1, 150, 33, 0, 1.5], passata: [100, 30, 1.5, 5, 0.2], laitcoco: [100, 190, 2, 3, 19], quinoa: [100, 370, 14, 64, 6],
  boulgour: [100, 350, 12, 70, 1.5], semoule: [100, 360, 12, 73, 1.5], beurrecacahuete: [1, 95, 4, 2.5, 8], amande: [100, 600, 21, 7, 53],
  pateslasagnes: [100, 350, 12, 72, 1.5], patescompletes: [100, 350, 13, 66, 2.5], riz: [100, 355, 7, 78, 0.8], oignon: [1, 40, 1, 9, 0.1],
  ail: [1, 5, 0.2, 1, 0], farine: [100, 350, 10, 73, 1], sucre: [100, 400, 0, 100, 0], levure: [1, 5, 0, 1, 0], chapelure: [100, 380, 12, 72, 5],
  lait: [100, 46, 3.3, 4.8, 1.5], huile: [1, 90, 0, 0, 10], huileneutre: [100, 900, 0, 0, 100], soja: [1, 10, 1.5, 1, 0], curry: [1, 20, 1, 3, 1],
  cumin: [1, 8, 0.4, 1, 0.5], paprika: [1, 6, 0.3, 1, 0.3], cannelle: [1, 6, 0.1, 2, 0], herbes: [1, 3, 0.1, 0.5, 0], origan: [1, 3, 0.1, 0.5, 0],
  aubergine: [1, 70, 3, 12, 0.5], tomatefraiche: [1, 22, 1, 4, 0.2], haricotsverts: [100, 30, 2, 4, 0.2], asperges: [100, 22, 2.4, 2, 0.2],
  potimarron: [100, 45, 1, 10, 0.1], endive: [1, 15, 1, 2, 0.1], concombre: [1, 40, 2, 6, 0.3], petitspois: [100, 75, 5, 11, 0.4],
  lardons: [100, 250, 16, 0.5, 20], saumon: [100, 200, 20, 0, 13], saucisse: [1, 200, 10, 1, 17], paleron: [100, 170, 22, 0, 9],
  poiscasses: [100, 330, 23, 50, 1.5], chevre: [100, 260, 18, 1, 21], saumonfume: [100, 180, 22, 0, 10], pizza: [1, 650, 18, 125, 6],
  houmous: [100, 230, 7, 14, 16], pesto: [1, 800, 10, 8, 80], moutarde: [1, 15, 1, 0.5, 1], miel: [1, 60, 0, 16, 0], raselhanout: [1, 6, 0.3, 1, 0.3],
  reblochon: [1, 1480, 92, 2, 120], creme: [100, 250, 2.5, 3.5, 25], cheddar: [100, 400, 25, 1, 33], raclette: [100, 340, 23, 0, 27],
  beurre: [100, 740, 0.7, 0.6, 82], biere: [100, 43, 0.3, 3.5, 0], steak: [1, 160, 25, 0.5, 6.5], cabillaud: [100, 85, 19, 0, 0.7],
  painburger: [1, 190, 6, 34, 3], chou: [1, 250, 13, 45, 2], garammasala: [1, 6, 0.3, 1, 0.3], cacahuetes: [100, 590, 26, 8, 50],
  nouillesriz: [100, 360, 6, 80, 0.6], nouillesramen: [100, 380, 10, 60, 12], painpita: [1, 160, 5, 32, 1], patefeuilletee: [1, 920, 12, 72, 66],
  epinardssurg: [100, 22, 3, 1, 0.4], mais: [1, 190, 5, 35, 2], cuisse: [1, 210, 24, 0, 12], echine: [100, 220, 18, 0, 16],
  rizrond: [100, 355, 7, 78, 0.8], agneau: [100, 200, 18, 0, 14], feves: [100, 70, 6, 8, 0.5], radis: [1, 20, 1, 3, 0.2],
  haricotsnoirs: [1, 240, 16, 38, 1], tahini: [1, 90, 2.5, 1, 8], abricotssecs: [100, 240, 3, 55, 0.5], chocolat: [100, 540, 6, 50, 32],
  pomme: [1, 80, 0.4, 19, 0.2], poire: [1, 90, 0.6, 22, 0.2], fruitsrouges: [100, 40, 1, 8, 0.3], flocons: [100, 370, 13, 60, 7],
  cacao: [1, 30, 2, 2, 1.5], levureboul: [1, 25, 3, 3, 0.5], raisinssecs: [100, 300, 3, 70, 0.5], pruneaux: [100, 240, 2, 56, 0.5],
  coco: [100, 650, 6, 24, 62], rhubarbe: [100, 20, 1, 3, 0.1], fraises: [100, 32, 0.7, 7, 0.3], orange: [1, 60, 1, 13, 0.2],
  abricots: [100, 48, 1, 10, 0.4], tofu: [100, 130, 14, 2, 7], panais: [100, 65, 1.5, 13, 0.5], navet: [100, 28, 1, 5, 0.1],
  topinambour: [100, 70, 2, 15, 0], celerirave: [100, 40, 1.5, 8, 0.3], fenouil: [1, 40, 3, 7, 0.4], noix: [100, 650, 15, 7, 65],
  polenta: [100, 355, 8, 77, 1], artichaut: [1, 50, 3, 9, 0.3], blette: [100, 20, 2, 3, 0.2], olives: [100, 150, 1, 4, 15],
  sesame: [1, 55, 1.8, 1.5, 4.5], melon: [1, 150, 3, 34, 0.5], peche: [1, 60, 1, 14, 0.3], basilic: [1, 10, 1, 1, 0.2], menthe: [1, 10, 1, 1, 0.2],
  betterave: [100, 45, 1.7, 9, 0.2], patatedouce: [100, 85, 1.6, 20, 0.1], chataigne: [100, 190, 3, 40, 2],
};

/** Mois de saison des légumes soumis à la saisonnalité (les autres légumes sont disponibles toute l'année). */
const range = (a, b) => (a <= b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [...range(a, 12), ...range(1, b)]);
const SEASON = {
  courgette: range(5, 10), poivron: range(6, 10), aubergine: range(6, 10), tomatefraiche: range(6, 9), concombre: range(5, 9),
  asperges: range(4, 6), haricotsverts: range(6, 10), feves: range(4, 6), radis: range(3, 10), artichaut: range(4, 6),
  melon: range(6, 9), peche: range(6, 9), basilic: range(5, 9), menthe: range(5, 9), fenouil: range(10, 4), endive: range(10, 4),
  chou: range(10, 3), choufleur: range(10, 4), brocoli: range(9, 3), butternut: range(9, 2), potimarron: range(9, 12),
  panais: range(10, 3), navet: range(10, 3), topinambour: range(10, 3), celerirave: range(10, 3), betterave: range(9, 3),
  blette: range(5, 10), patatedouce: range(9, 3), poireau: range(9, 4),
};
const ANIMAL = {
  poulet: "volaille", dinde: "volaille", cuisse: "volaille", boeuf: "boeuf", paleron: "boeuf", steak: "boeuf", agneau: "boeuf",
  jambon: "porc", lardons: "porc", saucisse: "porc", echine: "porc", saumon: "poisson", cabillaud: "poisson", thon: "poisson", saumonfume: "poisson",
};
const PRIORITY = ["boeuf", "porc", "volaille", "poisson"];

export const stats = { warnings: [], count: 0 };

export function macros(ing) {
  const t = [0, 0, 0, 0];
  for (const [k, q] of Object.entries(ing)) {
    const n = N[k];
    if (!n) throw new Error(`pas de valeurs nutritionnelles pour ${k}`);
    for (let i = 0; i < 4; i++) t[i] += (q / n[0]) * n[i + 1];
  }
  return t.map((v) => Math.round(v / 4));
}

/**
 * R(id, nom, nomCourt, pays, description, ingrédients, prepMin, préparation, blocs, options)
 * blocs : [[mode, minutes actives, minutes passives, texte, (true = peut chevaucher le précédent)]]
 * options : grp, comfort, pasta, kid, box, jj, fridge, freeze, diff, months, hp (≥ 40 g de protéines), veg
 */
export function R(id, n, s, o, d, ing, prepMin, prep, blocks, opt = {}) {
  const keys = Object.keys(ing);
  const animal = new Set(keys.map((k) => ANIMAL[k]).filter(Boolean));
  const p = PRIORITY.find((x) => animal.has(x)) ?? "veg";
  if (opt.veg && p !== "veg") throw new Error(`${id} : plat végétarien avec ${[...animal]}`);
  const m = macros(ing);

  let months = opt.months;
  if (!months) {
    const sets = keys.filter((k) => SEASON[k]).map((k) => SEASON[k]);
    if (sets.length) {
      const inter = range(1, 12).filter((mo) => sets.every((s) => s.includes(mo)));
      if (!inter.length) throw new Error(`${id} : légumes de saisons incompatibles`);
      if (inter.length < 12) months = inter;
      if (inter.length < 4) stats.warnings.push(`${id} : seulement ${inter.length} mois (${inter})`);
    }
  }
  if (opt.hp && m[1] < 40) stats.warnings.push(`${id} : hyper protéiné attendu, ${m[1]} g de protéines`);
  if (m[0] < 330 || m[0] > 850) stats.warnings.push(`${id} : ${m[0]} kcal par portion`);

  const active = blocks.reduce((s, b) => s + b[1], 0) + prepMin;
  stats.count++;
  const out = {
    id, n, s, p, ...(opt.grp ? { grp: opt.grp } : {}),
    ...(opt.comfort ? { comfort: true } : {}), ...(opt.pasta ? { pasta: true } : {}),
    fridge: opt.fridge ?? (p === "poisson" ? 2 : 3), freeze: opt.freeze ?? p !== "poisson",
    oven: blocks.some((b) => b[0] === "four"), m, diff: opt.diff ?? (active <= 25 ? 1 : active <= 40 ? 2 : 3), d,
    ...(months ? { months } : {}), ing, prepMin, prep: Array.isArray(prep) ? prep : [prep],
    blocks: blocks.map(([mode, a, ps, text, nowait]) => ({
      mode, active: a, passive: ps, ...(nowait ? { wait: false } : {}), a: [text],
    })),
    box: opt.box ?? "parts en boîtes", jj: opt.jj ?? "Réchauffe 2 min au micro-ondes.",
    ...(opt.kid ? { kid: opt.kid } : {}), o,
  };
  return out;
}
