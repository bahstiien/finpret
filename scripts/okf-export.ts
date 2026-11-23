// Exporte le catalogue global (seed/*.json) en bundle Open Knowledge Format (OKF v0.2) : un fichier Markdown par
// recette, ingrédient et petit-déjeuner, avec un en-tête YAML, lisible par un agent IA ou par un humain.
// Spécification : https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
//
// Le bundle est un export INTERNE (dossier okf/, ignoré par git) : il cite le magasin du relevé de prix, que le site
// ne montre que dans /cgv. Ne pas le publier tel quel.
//
// Usage : pnpm okf                (écrit okf/ puis le vérifie)
//         pnpm okf --out <dossier>
//         pnpm okf --check        (vérifie un bundle existant sans le réécrire)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { rawSeed } from "../src/engine/catalog/seed-files";
import { dur, num } from "../src/engine/format";
import { KIND_LABEL, RECIPES, slugOf, type RecipeKind, type RecipeView } from "../src/seo/catalog";
import { CONTENT_LASTMOD, SITE_URL } from "../src/seo/config";

const OKF_VERSION = "0.2";
const PRODUCER = "finpret-okf/1.0";
/** Un relevé de prix est considéré comme périmé 90 jours après la date du relevé. */
const PRICE_TTL_DAYS = 90;

const args = process.argv.slice(2);
const outArg = args.indexOf("--out");
const OUT = resolve(outArg >= 0 && args[outArg + 1] ? args[outArg + 1]! : "okf");
const CHECK_ONLY = args.includes("--check");

type Ingredient = { l: string; u: string; c: string; n?: string[]; s?: string };
type Price = {
  p: number;
  per: string;
  product?: string;
  pack?: string;
  packPrice?: number;
  note?: string;
  source?: string;
};
type Pack = { s: number[]; l: string; tol?: number };
type Breakfast = { t: string; n: string; d: string; m: number[] };

const ingredients = rawSeed.ingredients as Record<string, Ingredient>;
const packs = rawSeed.packs as Record<string, Pack>;
const aisles = new Map<string, string>([...(rawSeed.aisles as [string, string][]), ["base", "Placard"]]);
const priceMeta = rawSeed.prices._meta as {
  store: string;
  storeId: string;
  observedAt: string;
  policy: string;
};
const prices = rawSeed.prices.prices as Record<string, Price | null>;
const breakfasts = rawSeed.breakfasts as Breakfast[];

const KIND_DIR: Record<RecipeKind, string> = {
  plat: "plats",
  soupe: "soupes",
  simple: "soirs-simples",
  gouter: "gouters",
};
const KIND_TITLE: Record<RecipeKind, string> = {
  plat: "Plats de la session",
  soupe: "Soupes du soir",
  simple: "Soirs simples",
  gouter: "Goûters",
};
const UNIT_LABEL: Record<string, string> = {
  g: "grammes",
  ml: "millilitres",
  pc: "pièce",
  boite: "boîte de conserve",
  cs: "cuillère à soupe",
  cc: "cuillère à café",
};
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const DIFFICULTY = ["", "très facile", "facile", "intermédiaire", "technique"];
const PROTEIN: Record<string, string> = {
  volaille: "volaille",
  boeuf: "bœuf",
  porc: "porc",
  poisson: "poisson",
  veg: "végétarien",
};

// ---------------------------------------------------------------------------------------------------------------
// YAML : sous-ensemble suffisant pour l'en-tête. Les chaînes sont écrites en JSON, qui est du YAML valide.

type Yaml = string | number | boolean | null | Yaml[] | { [k: string]: Yaml | undefined };

function yamlValue(v: Yaml, indent: string): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== "object"))
      return `[${v.map((x) => yamlValue(x, "")).join(", ")}]`;
    return v.map((x) => `\n${indent}- ${yamlValue(x, indent + "  ").replace(/^\n\s*/, "")}`).join("");
  }
  const entries = Object.entries(v).filter(([, x]) => x !== undefined) as [string, Yaml][];
  return entries
    .map(([k, x]) => `\n${indent}${k}: ${yamlValue(x, indent + "  ")}`.replace(/: \n/, ":\n"))
    .join("");
}

function frontmatter(fields: Record<string, Yaml | undefined>): string {
  return `---${yamlValue(fields as Yaml, "")}\n---\n`;
}

// ---------------------------------------------------------------------------------------------------------------
// Chemins et liens (liens relatifs à la racine du bundle, recommandés par la spec).

const recipePath = (r: RecipeView) => `/recettes/${KIND_DIR[r.kind]}/${r.slug}`;
const ingredientPath = (k: string) => `/ingredients/${slugOf(k)}`;
const breakfastSlug = (b: Breakfast) =>
  slugOf(b.n.replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, ""));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const breakfastPath = (b: Breakfast) => `/petits-dejeuners/${breakfastSlug(b)}`;
const link = (label: string, path: string) => `[${label.replace(/([[\]])/g, "\\$1")}](${path})`;
/** Placeholders `{clé}` hors recette (petits-déjeuners) : même repli que le moteur, la clé elle-même. */
const plain = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => k);
const monthList = (m: number[]) => m.map((x) => MONTHS[x - 1]).join(", ");

const generatedAt = `${CONTENT_LASTMOD}T00:00:00+00:00`;
const generated = { by: PRODUCER, at: generatedAt };

const files = new Map<string, string>();
const put = (path: string, content: string) => {
  if (files.has(path)) throw new Error(`Deux concepts au même chemin : ${path}`);
  files.set(path, content);
};

// ---------------------------------------------------------------------------------------------------------------
// Recettes

const usedIn = new Map<string, RecipeView[]>();
for (const r of RECIPES) {
  const keys = new Set([
    ...Object.keys(r.raw),
    ...r.variants.flatMap((v) => v.ingredients.map((l) => l.key)),
  ]);
  for (const k of keys) if (ingredients[k]) usedIn.set(k, [...(usedIn.get(k) ?? []), r]);
}

function recipeTags(r: RecipeView): string[] {
  const t: string[] = [r.kind];
  if (r.batch) t.push("batch-cooking");
  if (r.protein && r.kind !== "gouter") t.push(slugOf(PROTEIN[r.protein] ?? r.protein));
  if (r.vegetarian && !t.includes("vegetarien")) t.push("vegetarien");
  if (r.freezable) t.push("congelable");
  if (r.oven) t.push("four");
  if (r.pasta) t.push("pates");
  if (r.comfort) t.push("reconfort");
  if (r.seasonal) t.push("variantes-de-saison");
  return t;
}

function recipeDoc(r: RecipeView): string {
  const fm = frontmatter({
    type: "Recette",
    title: r.name,
    description: r.description ?? `${KIND_LABEL[r.kind] ?? r.kind} : ${r.short}.`,
    resource: `${SITE_URL}/recettes/${r.slug}`,
    tags: recipeTags(r),
    status: "stable",
    generated,
    finpret: {
      id: r.id,
      kind: r.kind,
      yield: r.yieldText,
      difficulty: r.difficulty,
      total_min: r.totalMin,
      active_min: r.activeMin,
      fridge_days: r.fridgeDays,
      freezable: r.freezable,
      months: r.months,
      nutrition_per_adult_portion: r.nutrition,
    },
  });

  const out: string[] = [`# ${r.name}`, ""];
  if (r.description) out.push(r.description, "");

  const facts: string[] = [
    `- Type : ${KIND_TITLE[r.kind].toLowerCase()}`,
    `- Quantités pour : ${r.yieldText}`,
  ];
  if (r.difficulty)
    facts.push(`- Difficulté : ${DIFFICULTY[r.difficulty] ?? r.difficulty} (${r.difficulty}/4)`);
  if (r.totalMin)
    facts.push(
      `- Temps total : ${dur(r.totalMin)}${r.activeMin ? `, dont ${dur(r.activeMin)} de travail actif` : ""}`,
    );
  else if (r.timeText) facts.push(`- Temps : ${r.timeText}`);
  if (r.fridgeDays !== null)
    facts.push(
      `- Conservation : ${r.fridgeDays} jour${r.fridgeDays > 1 ? "s" : ""} au frigo après la session`,
    );
  facts.push(`- Congélation : ${r.freezable ? "oui" : "non"}`);
  if (r.country) facts.push(`- Origine : ${r.country}`);
  if (r.months) facts.push(`- Disponible en : ${monthList(r.months)}`);
  out.push("## En bref", "", ...facts, "");

  const ingTitle = r.seasonal ? "## Ingrédients (version de référence)" : "## Ingrédients";
  out.push(
    ingTitle,
    "",
    ...r.ingredients.map((l) => `- ${link(l.label, ingredientPath(l.key))} : ${l.qty}`),
    "",
  );

  if (r.variants.length) {
    out.push(
      "## Variantes de saison",
      "",
      "Les ingrédients de saison remplacent ceux de la version de référence selon le mois.",
      "",
    );
    for (const v of r.variants) {
      out.push(`### ${capitalize(v.label)} (${monthList(v.months)})`, "");
      out.push(...v.ingredients.map((l) => `- ${link(l.label, ingredientPath(l.key))} : ${l.qty}`), "");
    }
  }

  out.push("## Étapes", "", ...r.steps.map((s, i) => `${i + 1}. ${s}`), "");
  if (r.storage || r.reheat) {
    out.push("## Conservation et service", "");
    if (r.storage) out.push(`- Conditionnement : ${r.storage}`);
    if (r.reheat) out.push(`- Le jour du repas : ${r.reheat}`);
    out.push("");
  }
  if (r.kidTip) out.push("## Avec les enfants", "", r.kidTip, "");
  if (r.nutrition) {
    const n = r.nutrition;
    out.push(
      "## Valeurs nutritionnelles (estimation par portion adulte)",
      "",
      "| Énergie | Protéines | Glucides | Lipides |",
      "|---|---|---|---|",
      `| ${n.kcal} kcal | ${n.protein} g | ${n.carbs} g | ${n.fat} g |`,
      "",
    );
  }
  return fm + "\n" + out.join("\n");
}

for (const r of RECIPES) put(`${recipePath(r)}.md`, recipeDoc(r));

// ---------------------------------------------------------------------------------------------------------------
// Ingrédients (avec le prix de référence et sa provenance)

const observed = new Date(`${priceMeta.observedAt}T00:00:00+00:00`);
/** Politique de relevé sans la phrase sur les estimations web, qui ne concerne que les prix avec `source`. */
const drivePolicy = priceMeta.policy
  .split(/\.\s*Introuvable/)[0]!
  .trim()
  .replace(/\.?$/, ".");
const staleAfter = new Date(observed.getTime() + PRICE_TTL_DAYS * 86_400_000)
  .toISOString()
  .replace(".000Z", "+00:00");

function ingredientDoc(k: string, g: Ingredient): string {
  const price = prices[k] ?? null;
  const aisle = aisles.get(g.c) ?? g.c;
  const fm = frontmatter({
    type: "Ingrédient",
    title: g.l,
    description: `${g.l}, rayon « ${aisle} », compté en ${UNIT_LABEL[g.u] ?? g.u} dans les recettes.`,
    tags: [slugOf(g.c)],
    status: "stable",
    generated,
    sources: price
      ? [
          {
            id: "prix",
            resource: price.source ?? `urn:finpret:releve-prix:leclerc-drive:${priceMeta.storeId}`,
            title: price.source ? "Estimation web (introuvable au drive)" : priceMeta.store,
            last_modified: `${priceMeta.observedAt}T00:00:00+00:00`,
          },
        ]
      : undefined,
    stale_after: price ? staleAfter : undefined,
    finpret: { key: k, unit: g.u, aisle: g.c },
  });

  const out: string[] = [
    `# ${g.l}`,
    "",
    `- Rayon : ${aisle}${g.c === "base" ? " (non acheté par défaut)" : ""}`,
  ];
  out.push(`- Unité de recette : ${UNIT_LABEL[g.u] ?? g.u}${g.s ? ` (${g.s.trim()})` : ""}`);
  if (g.n) out.push(`- Nom à l'unité : ${g.n[0]} / ${g.n[1]}`);
  out.push("");

  out.push("## Prix de référence", "");
  if (price) {
    out.push(`${num(price.p)} € par ${price.per}, relevé le ${priceMeta.observedAt} [^prix].`, "");
    if (price.product) out.push(`- Produit retenu : ${price.product}`);
    if (price.pack)
      out.push(`- Contenance : ${price.pack}${price.packPrice ? ` à ${num(price.packPrice)} €` : ""}`);
    if (price.note) out.push(`- Hypothèse : ${price.note}`);
    out.push(
      "",
      `[^prix]: ${price.source ? `Estimation web : ${price.source}` : `${priceMeta.store}. ${drivePolicy}`}`,
      "",
    );
  } else {
    out.push("Pas de prix relevé : le coût des recettes qui l'utilisent ne le compte pas.", "");
  }

  const p = packs[k];
  if (p) {
    out.push("## Contenants du commerce", "", `${p.l} de ${p.s.map((s) => `${s} ${g.u}`).join(" ou ")}.`, "");
  }

  const used = usedIn.get(k) ?? [];
  if (used.length) {
    out.push(
      `## Utilisé dans (${used.length})`,
      "",
      ...used.map((r) => `- ${link(r.name, recipePath(r))}`),
      "",
    );
  }
  return fm + "\n" + out.join("\n");
}

for (const [k, g] of Object.entries(ingredients)) put(`${ingredientPath(k)}.md`, ingredientDoc(k, g));

// ---------------------------------------------------------------------------------------------------------------
// Petits-déjeuners

for (const b of breakfasts) {
  const fm = frontmatter({
    type: "Petit-déjeuner",
    title: plain(b.n),
    description: plain(b.d),
    tags: [b.t === "sale" ? "sale" : "sucre"],
    status: "stable",
    generated,
    finpret: { kcal: b.m[0] ?? null, protein_g: b.m[1] ?? null },
  });
  const body = [`# ${plain(b.n)}`, "", plain(b.d), "", `- Goût : ${b.t === "sale" ? "salé" : "sucré"}`];
  if (b.m[0]) body.push(`- Estimation : ${b.m[0]} kcal, ${b.m[1]} g de protéines`);
  put(`${breakfastPath(b)}.md`, fm + "\n" + body.join("\n") + "\n");
}

// ---------------------------------------------------------------------------------------------------------------
// Index (sans en-tête, sauf okf_version à la racine) et journal

const kinds: RecipeKind[] = ["plat", "soupe", "simple", "gouter"];
for (const kind of kinds) {
  const list = RECIPES.filter((r) => r.kind === kind).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  put(
    `/recettes/${KIND_DIR[kind]}/index.md`,
    [`# ${KIND_TITLE[kind]}`, "", ...list.map((r) => `- ${link(r.name, recipePath(r))}`), ""].join("\n"),
  );
}
put(
  "/recettes/index.md",
  [
    "# Recettes",
    "",
    ...kinds.map(
      (k) =>
        `- ${link(KIND_TITLE[k], `/recettes/${KIND_DIR[k]}/index`)} (${RECIPES.filter((r) => r.kind === k).length})`,
    ),
    "",
  ].join("\n"),
);

const byAisle = new Map<string, string[]>();
for (const [k, g] of Object.entries(ingredients)) byAisle.set(g.c, [...(byAisle.get(g.c) ?? []), k]);
const ingIndex = ["# Ingrédients", ""];
for (const [c, label] of aisles) {
  const keys = byAisle.get(c);
  if (!keys?.length) continue;
  ingIndex.push(
    `## ${label}`,
    "",
    ...keys
      .sort((a, b) => ingredients[a]!.l.localeCompare(ingredients[b]!.l, "fr"))
      .map((k) => `- ${link(ingredients[k]!.l, ingredientPath(k))}`),
    "",
  );
}
put("/ingredients/index.md", ingIndex.join("\n"));
put(
  "/petits-dejeuners/index.md",
  ["# Petits-déjeuners", "", ...breakfasts.map((b) => `- ${link(plain(b.n), breakfastPath(b))}`), ""].join(
    "\n",
  ),
);

const counts = {
  recipes: RECIPES.length,
  ingredients: Object.keys(ingredients).length,
  priced: Object.values(prices).filter(Boolean).length,
  breakfasts: breakfasts.length,
};
put(
  "/index.md",
  [
    `---\nokf_version: "${OKF_VERSION}"\n---`,
    "",
    "# Fin Prêt — catalogue de recettes",
    "",
    "Catalogue global de Fin Prêt (planification de repas et batch cooking pour les familles), exporté depuis `seed/*.json` par `pnpm okf`.",
    "Quantités pour 4 portions adultes ; valeurs nutritionnelles estimées par portion adulte.",
    "",
    "> Export interne : les fiches ingrédients citent le magasin du relevé de prix. Ne pas publier tel quel.",
    "",
    "## Contenu",
    "",
    `- ${link("Recettes", "/recettes/index")} (${counts.recipes})`,
    `- ${link("Ingrédients", "/ingredients/index")} (${counts.ingredients}, dont ${counts.priced} avec un prix de référence)`,
    `- ${link("Petits-déjeuners", "/petits-dejeuners/index")} (${counts.breakfasts})`,
    `- ${link("Journal", "/log")}`,
    "",
  ].join("\n"),
);
put(
  "/log.md",
  [
    "# Journal",
    "",
    `## ${CONTENT_LASTMOD}`,
    "",
    `- Contenu du catalogue à jour au ${CONTENT_LASTMOD} (CONTENT_LASTMOD de src/seo/config.ts).`,
    `- Prix relevés le ${priceMeta.observedAt} (${priceMeta.store}) ; périmés après ${staleAfter.slice(0, 10)}.`,
    "",
  ].join("\n"),
);

// ---------------------------------------------------------------------------------------------------------------
// Écriture et vérification

function listMd(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listMd(p) : f.endsWith(".md") ? [p] : [];
  });
}

/** Vérifie les règles OKF utiles ici : `type` présent dans chaque concept, index sans en-tête, liens internes résolus. */
function check(dir: string): string[] {
  const errors: string[] = [];
  const all = listMd(dir);
  const ids = new Set(all.map((p) => "/" + relative(dir, p).split(sep).join("/").replace(/\.md$/, "")));
  for (const p of all) {
    const id = "/" + relative(dir, p).split(sep).join("/").replace(/\.md$/, "");
    const text = readFileSync(p, "utf8");
    const name = id.split("/").pop();
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1];
    if (name === "index" || name === "log") {
      if (fm && !(id === "/index" && /^okf_version: /.test(fm) && !fm.includes("\n")))
        errors.push(`${id} : en-tête interdit`);
    } else if (!fm || !/^type: \S/m.test(fm)) {
      errors.push(`${id} : en-tête sans « type »`);
    }
    for (const [, target] of text.matchAll(/\]\((\/[^)\s#]+)\)/g)) {
      if (!ids.has(target!)) errors.push(`${id} : lien cassé vers ${target}`);
    }
  }
  return errors;
}

if (!CHECK_ONLY) {
  if (existsSync(OUT)) {
    const root = join(OUT, "index.md");
    const isBundle = existsSync(root) && readFileSync(root, "utf8").startsWith("---\nokf_version:");
    if (!isBundle && readdirSync(OUT).length)
      throw new Error(`${OUT} existe et n'est pas un bundle OKF : rien n'est écrasé.`);
    rmSync(OUT, { recursive: true, force: true });
  }
  for (const [path, content] of files) {
    const target = join(OUT, ...path.split("/").filter(Boolean));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content.endsWith("\n") ? content : content + "\n", "utf8");
  }
  console.log(
    `Bundle OKF écrit dans ${relative(process.cwd(), OUT) || "."} : ${files.size} fichiers ` +
      `(${counts.recipes} recettes, ${counts.ingredients} ingrédients dont ${counts.priced} avec prix, ${counts.breakfasts} petits-déjeuners).`,
  );
}

const errors = check(OUT);
if (errors.length) {
  console.error(
    `${errors.length} problème(s) :\n` +
      errors
        .slice(0, 30)
        .map((e) => `  - ${e}`)
        .join("\n"),
  );
  process.exit(1);
}
console.log(
  "Vérification OK : chaque concept a un type, les index n'ont pas d'en-tête, tous les liens internes sont résolus.",
);
