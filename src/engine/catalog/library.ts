import type { Library } from "../types";
import type { Seed } from "./schema";

/** Catalogue du moteur à partir du seed validé (tests, script de seed). L'application le construit depuis la base. */
export function libraryFromSeed(seed: Seed): Library {
  return {
    mains: seed.mains,
    soups: seed.soups,
    simples: seed.simples,
    cakes: seed.cakes,
    ingredients: seed.ingredients,
    packs: seed.packs,
    notSeasonal: seed.notSeasonal,
    aisles: seed.aisles,
  };
}
