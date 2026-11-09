import { INGREDIENT_ALLERGENS } from "./allergens";
import { ANIMAL_PROTEIN, allIngredientKeys, deriveProtein, orphanPlaceholders } from "./derive";
import { catalogRecipeRow, type RecipeRow } from "./rows";
import { cakeSchema, mainSchema, type Protein, simpleSchema, soupSchema } from "./schema";

/**
 * Recette du catalogue global écrite depuis le back-office (suggestions des utilisateurs) : mêmes règles que
 * `validateSeed` pour une recette seule, pour qu'une recette ajoutée à la main se comporte comme une recette du seed.
 */

export const EDITABLE_KINDS = ["main", "soup", "simple", "cake"] as const;
export type EditableKind = (typeof EDITABLE_KINDS)[number];

export const EDITABLE_KIND_LABEL: Record<EditableKind, string> = {
  main: "Plat de la session",
  soup: "Soupe",
  simple: "Soir simple",
  cake: "Goûter",
};

const SCHEMAS = { main: mainSchema, soup: soupSchema, simple: simpleSchema, cake: cakeSchema } as const;

export const RECIPE_ID = /^[a-z0-9_]{2,60}$/;

/** Identifiant proposé à partir du nom (« Gratin de pâtes » → `gratin_pates`), préfixe `c_` pour un goûter. */
export function suggestRecipeId(name: string, kind: EditableKind): string {
  const stop = new Set(["de", "du", "des", "la", "le", "les", "a", "au", "aux", "et", "en", "l", "d"]);
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !stop.has(w))
    .slice(0, 4)
    .join("_");
  const base = slug.length >= 2 ? slug : "recette";
  return (kind === "cake" && !base.startsWith("c_") ? `c_${base}` : base).slice(0, 60);
}

/** Squelette JSON d'une nouvelle recette, au format de seed/README.md, à compléter dans le back-office. */
export function recipeTemplate(kind: EditableKind, name: string): Record<string, unknown> {
  const n = name.trim() || "Nom complet de la recette";
  switch (kind) {
    case "main":
    case "soup":
      return {
        n,
        s: n,
        d: "Description courte",
        o: "fr",
        p: "veg",
        fridge: 3,
        freeze: true,
        diff: 1,
        m: [0, 0, 0, 0],
        ing: {},
        prepMin: 10,
        prep: [],
        blocks: [{ mode: "feu", active: 10, passive: 20, a: ["Étape de cuisson avec {ingredient}."] }],
        box: "Conditionnement",
        jj: "Consigne du jour du repas",
        ...(kind === "main" && { oven: false }),
      };
    case "simple":
      return { n, s: n, o: "fr", m: [0, 0, 0, 0], diff: 1, ing: {}, steps: ["Étape avec {ingredient}."] };
    case "cake":
      return {
        n,
        t: "gateau",
        tm: "45 min",
        parts: "8 parts",
        m: [0, 0, 0, 0],
        diff: 1,
        kid: "Tâche pour l'enfant",
        ing: {},
        steps: ["Étape avec {ingredient}."],
      };
  }
}

export type CheckedRecipe = { ok: true; row: RecipeRow } | { ok: false; issues: string[] };

/**
 * Valide une recette (sans `id` dans `data`) et construit sa ligne `recipes`.
 * `ingredients` : clés connues du catalogue global (les ingrédients d'un foyer n'y ont pas leur place).
 */
export function checkCatalogRecipe(
  kind: EditableKind,
  id: string,
  data: unknown,
  ingredients: ReadonlySet<string>,
): CheckedRecipe {
  if (!RECIPE_ID.test(id))
    return { ok: false, issues: ["identifiant : 2 à 60 caractères, minuscules, chiffres et _"] };
  if (!data || typeof data !== "object" || Array.isArray(data))
    return { ok: false, issues: ["la recette doit être un objet JSON"] };
  if ("id" in data) return { ok: false, issues: ["retire le champ « id » du JSON : il se saisit à part"] };

  const parsed = SCHEMAS[kind].safeParse({ ...data, id });
  if (!parsed.success)
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "recette"} : ${i.message}`),
    };
  const r = parsed.data;
  const issues: string[] = [];
  const keys = allIngredientKeys(r);
  if (!keys.length) issues.push("ing : au moins un ingrédient");
  for (const key of keys) {
    if (!ingredients.has(key)) issues.push(`ingrédient inconnu du catalogue : ${key}`);
    else if (!(key in INGREDIENT_ALLERGENS))
      issues.push(`ingrédient ${key} : absent de la table des allergènes`);
  }
  for (const orphan of orphanPlaceholders(r)) issues.push(`placeholder orphelin {${orphan}}`);
  // Plats et soupes : `p` doit correspondre aux ingrédients ; soirs simples : protéine déduite ; goûters : aucune.
  const declared = kind === "main" || kind === "soup" ? (r as { p: Protein }).p : null;
  if (declared && declared !== "veg" && !keys.some((k) => ANIMAL_PROTEIN[k] === declared))
    issues.push(`protéine « ${declared} » absente des ingrédients`);
  if (issues.length) return { ok: false, issues };

  const protein = declared ?? (kind === "simple" ? deriveProtein(Object.keys(r.ing)) : null);
  return { ok: true, row: catalogRecipeRow(kind, r, protein) };
}
