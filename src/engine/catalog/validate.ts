import { INGREDIENT_ALLERGENS } from "./allergens";
import { ANIMAL_PROTEIN, allIngredientKeys, breakfastId, orphanPlaceholders } from "./derive";
import { PANTRY_AISLE } from "./rows";
import { type Seed, seedSchema } from "./schema";

/**
 * Valide la forme du seed (Zod strict) puis ses références croisées.
 * `issues` : problèmes bloquants (vide si le seed peut être importé).
 * `warnings` : incohérences tolérées, à connaître (voir le test qui les fige).
 */
export function validateSeed(raw: unknown): { seed: Seed | null; issues: string[]; warnings: string[] } {
  const parsed = seedSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      seed: null,
      issues: parsed.error.issues.map((i) => `forme : ${i.path.join(".")} : ${i.message}`),
      warnings: [],
    };
  }
  const seed = parsed.data;
  const issues: string[] = [];
  const warnings: string[] = [];
  const known = (key: string) => key in seed.ingredients;

  const aisleKeys = new Set([...seed.aisles.map(([key]) => key), PANTRY_AISLE.key]);
  for (const [key, ingredient] of Object.entries(seed.ingredients)) {
    if (!aisleKeys.has(ingredient.c)) issues.push(`ingrédient ${key} : rayon inconnu « ${ingredient.c} »`);
    if (ingredient.u === "pc" && !ingredient.n) issues.push(`ingrédient ${key} : unité « pc » sans formes n`);
    if (!(key in INGREDIENT_ALLERGENS)) issues.push(`ingrédient ${key} : absent de la table des allergènes`);
  }
  for (const key of Object.keys(INGREDIENT_ALLERGENS)) {
    if (!known(key)) issues.push(`table des allergènes : ingrédient inconnu ${key}`);
  }
  for (const [key, pack] of Object.entries(seed.packs)) {
    if (!known(key)) issues.push(`contenant : ingrédient inconnu ${key}`);
    else if (!["g", "ml"].includes(seed.ingredients[key]!.u)) {
      issues.push(`contenant ${key} : unité « ${seed.ingredients[key]!.u} » (g ou ml attendu)`);
    }
    if (pack.s.length === 2 && pack.s[0]! >= pack.s[1]!)
      issues.push(`contenant ${key} : tailles non croissantes`);
  }
  for (const key of seed.notSeasonal) {
    if (!known(key)) issues.push(`notSeasonal : ingrédient inconnu ${key}`);
  }

  const recipes = [
    ...seed.mains.map((r) => ({ kind: "plat", r })),
    ...seed.soups.map((r) => ({ kind: "soupe", r })),
    ...seed.simples.map((r) => ({ kind: "soir simple", r })),
    ...seed.cakes.map((r) => ({ kind: "goûter", r })),
  ];
  const ids = new Map<string, number>();
  for (const { kind, r } of recipes) {
    ids.set(r.id, (ids.get(r.id) ?? 0) + 1);
    const label = `${kind} ${r.id}`;
    for (const key of allIngredientKeys(r)) {
      if (!known(key)) issues.push(`${label} : ingrédient inconnu ${key}`);
    }
    for (const orphan of orphanPlaceholders(r)) issues.push(`${label} : placeholder orphelin {${orphan}}`);
  }
  for (const b of seed.breakfasts) {
    const id = breakfastId(b.n);
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  for (const [id, count] of ids) if (count > 1) issues.push(`identifiant en double : ${id} (${count} fois)`);

  // Le champ `p` des plats et soupes doit être cohérent avec leurs ingrédients. Exception tolérée :
  // une soupe « veg » servie avec des tartines garnies (jambon, thon) le jour du repas. `p` sert à
  // l'équilibre des protéines du prototype ; le régime, lui, est déduit de tous les ingrédients.
  for (const r of [...seed.mains, ...seed.soups]) {
    const animal = new Set(
      allIngredientKeys(r)
        .map((k) => ANIMAL_PROTEIN[k])
        .filter(Boolean),
    );
    if (r.p === "veg" && animal.size > 0)
      warnings.push(`${r.id} : marqué végétarien mais contient ${[...animal]}`);
    if (r.p !== "veg" && !animal.has(r.p))
      issues.push(`${r.id} : protéine « ${r.p} » absente des ingrédients`);
  }

  return { seed, issues, warnings };
}
