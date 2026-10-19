/** Textes produits par le moteur (session, rangement). Repris du prototype ; réexportés par fr.ts. */
export const engineFr = {
  session: {
    nothing: {
      name: "Rien à cuisiner",
      where: "Cuisine",
      task: "Tous les repas à préparer ont été retirés cette semaine.",
    },
    setup: {
      name: "Mise en place",
      where: "Cuisine",
      preheat: (racks: number) =>
        `Préchauffe le four à 180 °C en chaleur tournante, avec ${racks} grille${racks > 1 ? "s" : ""}.`,
      noOven: "Pas de four cette semaine.",
      airfryer: "Sors l'air fryer et vérifie que le panier est propre.",
      wash: "Sors les ingrédients de l'étape suivante et lave les légumes.",
      boxes: "Prépare les boîtes repas et des petits pots pour les sauces.",
    },
    ingredients: {
      name: "Ingrédients de la session",
      where: "Plan de travail",
      lead: "Coche chaque ingrédient une fois sorti. Les féculents et les garnitures servis le jour même ne sont pas dans cette liste.",
      line: (label: string, qty: string) => `${label} : ${qty}`,
    },
    where: {
      oven: (n: number) => `Four, grille ${n}`,
      burner: (n: number) => `Plaque ${n}`,
      airfryer: "Air fryer",
      blender: "Blender chauffant",
      micro: "Micro-ondes",
      robot: "Robot pâtissier",
      mixeur: "Mixeur plongeant",
      plan: "Plan de travail",
    },
    cooling: {
      name: "Refroidissement",
      where: "Plan de travail",
      tasks: [
        "Éteins tout et découvre les cocottes.",
        "Laisse refroidir 20 à 30 min. Jamais plus de 2 h à température ambiante.",
        "Profite de l'attente pour laver la vaisselle.",
      ],
    },
    portioning: {
      name: "Portionnage",
      where: "Boîtes",
      box: (portions: string, label: string) => `1 boîte de ${portions} portions pour ${label}`,
      main: (name: string, box: string, boxes: string) => `${name} (${box}) : ${boxes}.`,
      soup: (name: string, boxes: string) => `${name} : ${boxes}.`,
      doubled: (n: number) =>
        ` Plus ${n} boîtes identiques pour la banque du congélateur, étiquetées avec la date.`,
      label: "Étiquette chaque boîte avec le jour et le repas. Ne cuis pas les féculents prévus le jour J.",
    },
    storage: {
      name: "Frigo et congélateur",
      where: "Rangement",
      fridge: (items: string) => `Au frigo : ${items}.`,
      bank: (items: string) => `Banque du congélateur : ${items}.`,
      bankItem: (n: number, name: string) => `${n} boîtes de ${name}`,
      fromBank: (items: string) => `Rien à cuisiner pour ${items} : ces repas viennent de la banque.`,
      fromBankItem: (label: string, name: string) => `${label} (${name})`,
      freezer: (items: string) => `Au congélateur : ${items}.`,
      thaw: (label: string, day: string) => `${label} : à sortir ${day} soir`,
      simples: (items: string) =>
        `Repas simples à cuisiner le soir même : ${items}. Garde leurs ingrédients au frais.`,
      keep: (items: string) =>
        `Restes de contenants à garder pour la semaine prochaine : ${items}. Ils iront dans le garde-manger.`,
      keepItem: (qty: string, label: string) => `${qty} de ${label}`,
      used: (items: string) => `Terminés cette semaine, retirés du garde-manger : ${items}.`,
    },
  },
} as const;
