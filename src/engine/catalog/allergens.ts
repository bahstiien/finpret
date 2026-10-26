/**
 * Les 14 allergènes réglementaires (règlement UE 1169/2011, annexe II) et leur présence dans
 * les ingrédients du catalogue.
 *
 * TODO(spec) §16 Q1 : table établie à partir des libellés du catalogue et de la composition
 * courante des produits du commerce, À FAIRE VALIDER par le Product Owner. Choix prudents :
 * un ingrédient qui contient souvent l'allergène dans sa version industrielle est marqué
 * (pain de mie et lait, pesto et fruits à coque, pains à burger et sésame…). L'exclusion est
 * stricte (§6) : mieux vaut écarter une recette de trop qu'en proposer une dangereuse.
 */

export const ALLERGENS = {
  gluten: "Gluten",
  crustaces: "Crustacés",
  oeufs: "Œufs",
  poisson: "Poisson",
  arachides: "Arachides",
  soja: "Soja",
  lait: "Lait",
  fruits_a_coque: "Fruits à coque",
  celeri: "Céleri",
  moutarde: "Moutarde",
  sesame: "Sésame",
  sulfites: "Sulfites",
  lupin: "Lupin",
  mollusques: "Mollusques",
} as const;

export type Allergen = keyof typeof ALLERGENS;

/**
 * Allergènes par ingrédient. Chaque ingrédient du catalogue DOIT figurer ici, même sans
 * allergène (`[]`) : un test vérifie que la table est complète, pour qu'un nouvel ingrédient
 * ne passe jamais sans décision.
 */
export const INGREDIENT_ALLERGENS: Record<string, readonly Allergen[]> = {
  // Viande et poisson
  poulet: [],
  boeuf: [],
  dinde: [],
  jambon: [],
  lardons: [],
  saumon: ["poisson"],
  saucisse: [], // TODO(spec) : certaines saucisses contiennent du gluten ou de la moutarde
  paleron: [],
  steak: [],
  cabillaud: ["poisson"],
  cuisse: [],
  echine: [],
  agneau: [],

  // Crèmerie et œufs
  oeufs: ["oeufs"],
  feta: ["lait"],
  emmental: ["lait"],
  parmesan: ["lait"],
  skyr: ["lait"],
  fromageblanc: ["lait"],
  yaourt: ["lait"],
  cottage: ["lait"],
  mozzarella: ["lait"],
  ricotta: ["lait"],
  patesfraiches: ["gluten", "oeufs", "lait"], // pâtes aux œufs farcies ricotta-épinards
  galette: [], // TODO(spec) : sarrasin pur sans gluten, mais souvent mélangé à du blé
  patebrisee: ["gluten", "lait"],
  gnocchis: ["gluten"],
  chevre: ["lait"],
  saumonfume: ["poisson"],
  pizza: ["gluten"],
  houmous: ["sesame"], // tahini
  reblochon: ["lait"],
  creme: ["lait"],
  cheddar: ["lait"],
  raclette: ["lait"],
  patefeuilletee: ["gluten", "lait"],

  // Boulangerie
  pain: ["gluten"],
  painmie: ["gluten", "lait"],
  painburger: ["gluten", "sesame"],
  painpita: ["gluten"],

  // Fruits et légumes
  salade: [],
  courgette: [],
  banane: [],
  citron: [],
  poivron: [],
  carotte: [],
  epinards: [],
  pommedeterre: [],
  butternut: [],
  choufleur: [],
  brocoli: [],
  champignons: [],
  poireau: [],
  persil: [],
  gingembre: [],
  aubergine: [],
  tomatefraiche: [],
  haricotsverts: [],
  asperges: [],
  potimarron: [],
  endive: [],
  concombre: [],
  chou: [],
  feves: [],
  radis: [],
  pomme: [],
  poire: [],
  fruitsrouges: [],
  rhubarbe: [],
  fraises: [],
  orange: [],
  abricots: [],

  // Surgelés
  edamame: ["soja"],
  petitspois: [],
  epinardssurg: [],

  // Épicerie
  tortilla: ["gluten"],
  haricotsblancs: [],
  lentillescorail: [],
  lentillesvertes: [],
  poischiches: [],
  haricotsrouges: [],
  tomates: [],
  thon: ["poisson"],
  passata: [],
  laitcoco: [],
  quinoa: [],
  boulgour: ["gluten"],
  semoule: ["gluten"],
  beurrecacahuete: ["arachides"],
  amande: ["fruits_a_coque"],
  pateslasagnes: ["gluten"],
  patescompletes: ["gluten"],
  poiscasses: [],
  pesto: ["lait", "fruits_a_coque"], // parmesan ; noix de cajou dans beaucoup de pestos du commerce
  biere: ["gluten"],
  cacahuetes: ["arachides"],
  nouillesriz: [],
  nouillesramen: ["gluten"],
  mais: [],
  rizrond: [],
  haricotsnoirs: [],
  tahini: ["sesame"],
  abricotssecs: ["sulfites"],
  chocolat: [], // TODO(spec) : traces de lait fréquentes dans le chocolat noir
  flocons: ["gluten"], // avoine, céréale à gluten au sens du règlement
  cacao: [],
  levureboul: [],
  raisinssecs: ["sulfites"],
  pruneaux: [],
  coco: [], // la noix de coco n'est pas un fruit à coque réglementaire

  // Placard
  bouillon: ["celeri"], // TODO(spec) : les cubes contiennent souvent du céleri, parfois du gluten
  riz: [],
  oignon: [],
  ail: [],
  farine: ["gluten"],
  sucre: [],
  levure: [],
  chapelure: ["gluten"],
  lait: ["lait"],
  huile: [],
  huileneutre: [],
  soja: ["soja", "gluten"], // la sauce soja classique contient du blé
  curry: [], // TODO(spec) : certains mélanges contiennent de la moutarde ou du céleri
  cumin: [],
  paprika: [],
  cannelle: [],
  herbes: [],
  origan: [],
  moutarde: ["moutarde"],
  miel: [],
  raselhanout: [],
  beurre: ["lait"],
  garammasala: [],

  // Ajoutés avec les recettes de saison (à valider avec le reste de la table, voir TODO ci-dessus)
  tofu: ["soja"],
  panais: [],
  navet: [],
  topinambour: [],
  celerirave: ["celeri"],
  fenouil: [],
  noix: ["fruits_a_coque"],
  polenta: [],
  artichaut: [],
  blette: [],
  olives: [],
  sesame: ["sesame"],
  melon: [],
  peche: [],
  basilic: [],
  menthe: [],
  betterave: [],
  patatedouce: [],
  chataigne: [],
};
