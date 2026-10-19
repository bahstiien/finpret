// Contenu brut de seed/*.json, pour les tests et le script `pnpm seed`.
// À ne pas importer depuis l'application : le catalogue se lit en base.
import aisles from "../../../seed/aisles.json";
import breakfasts from "../../../seed/breakfasts.json";
import cakes from "../../../seed/cakes.json";
import ingredients from "../../../seed/ingredients.json";
import mains from "../../../seed/mains.json";
import notSeasonal from "../../../seed/notSeasonal.json";
import packs from "../../../seed/packs.json";
import simples from "../../../seed/simples.json";
import soups from "../../../seed/soups.json";

export const rawSeed = { ingredients, aisles, packs, notSeasonal, mains, soups, simples, cakes, breakfasts };
