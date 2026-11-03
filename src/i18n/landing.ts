/**
 * Textes de la landing (maquette v2.1). Tutoiement, espaces insécables avant « ? : ; ! ».
 *
 * Règle éditoriale : chaque chiffre ou fonction annoncé ici doit exister dans le produit. Les chiffres de
 * l'exemple de semaine (`example`) et du catalogue sont vérifiés par `src/engine/landing-example.test.ts`,
 * qui régénère la semaine avec le vrai moteur. Fonctions reportées (`src/lib/features.ts`) : ne pas les citer.
 */

const hm = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;

/** Exemple de semaine : sortie du moteur (graine 1, semaine du 1er mars 2027, réglages et équipement par défaut). */
export const landingExample = {
  weekStart: "2027-03-01",
  household: "2 adultes et 2 enfants de 7 et 4 ans, qui mangent à la cantine le midi en semaine",
  meals: 10,
  recipes: 5,
  portions: 26.25,
  /** Durée estimée par l'application (minutes) : niveau « à l'aise », puis niveau « débutant » (+20 % par étape). */
  sessionMinutes: 163,
  beginnerMinutes: 184,
  /** Fourchette des estimations sur 24 semaines générées pour ce foyer (4 dates × 6 graines). */
  rangeMinutes: [123, 203],
  boxes: 10,
  fridgeMeals: 7,
  freezerMeals: 3,
  recipesList: [
    {
      name: "Pâtes saumon-poireaux",
      meals: [
        ["lundi soir", 3.25],
        ["mardi midi", 2],
      ],
      gestures: [
        {
          kind: "Assembler",
          text: "cuire les pâtes, réchauffer doucement la sauce, ajouter le fromage blanc hors du feu.",
        },
      ],
    },
    {
      name: "Bolognaise dinde-lentilles",
      meals: [
        ["mercredi soir", 3.25],
        ["jeudi midi", 2],
      ],
      gestures: [
        { kind: "Réchauffer", text: "2 min au micro-ondes ; pâtes et sauce sont dans des boîtes à part." },
        { kind: "Décongeler", text: "la boîte de jeudi midi sort du congélateur mercredi soir." },
      ],
    },
    {
      name: "Agneau confit-pommes de terre",
      meals: [
        ["lundi midi", 2],
        ["vendredi soir", 3.25],
      ],
      gestures: [
        { kind: "Réchauffer", text: "2 min au micro-ondes." },
        { kind: "Décongeler", text: "la boîte de vendredi soir sort du congélateur jeudi soir." },
      ],
    },
    {
      name: "Curry pois chiches-épinards",
      meals: [
        ["mercredi midi", 2],
        ["vendredi midi", 2],
      ],
      gestures: [
        { kind: "Réchauffer", text: "2 min au micro-ondes ; riz et curry sont dans la même boîte." },
        { kind: "Décongeler", text: "la boîte de vendredi midi sort du congélateur jeudi soir." },
      ],
    },
    {
      name: "Velouté chou-fleur",
      meals: [
        ["mardi soir", 3.25],
        ["jeudi soir", 3.25],
      ],
      gestures: [{ kind: "Réchauffer", text: "puis pois chiches, parmesan râpé et pain à table." }],
    },
  ],
  shopping: [
    {
      aisle: "Viande et poisson",
      items: [
        "Pavés de saumon : 3 pavés de 125 g",
        "Haché de dinde : 790 g",
        "Épaule d'agneau désossée : 920 g",
      ],
    },
    {
      aisle: "Fruits et légumes",
      items: [
        "Poireaux : 4",
        "Citrons : 2",
        "Carottes : 3",
        "Pommes de terre : 1,2 kg",
        "Épinards frais : 1 sachet de 500 g",
        "Gingembre frais : 1",
        "Chou-fleur : 1,3 kg",
        "Fruits rouges (frais ou surgelés) : 150 g",
      ],
    },
    {
      aisle: "Crèmerie et œufs",
      items: ["Fromage blanc : 1 pot de 500 g", "Parmesan râpé : 100 g", "Œufs : 2"],
    },
    {
      aisle: "Épicerie",
      items: [
        "Pâtes complètes : 2 paquets de 500 g",
        "Lentilles corail : 1 sachet de 500 g",
        "Tomates concassées : 4 boîtes de 400 g",
        "Pois chiches : 5 boîtes de 400 g",
        "Lait de coco light : 1 boîte de 200 ml",
      ],
    },
    { aisle: "Boulangerie", items: ["Pain complet (tranches) : 13"] },
  ],
  /** Étapes de la session telles que le moteur les ordonne : minute de départ et libellé. */
  sessionSteps: [
    { at: 0, text: "Mise en place : four préchauffé, boîtes et pots prêts." },
    { at: 5, text: "Agneau confit-pommes de terre : découpe, puis four (90 min)." },
    { at: 23, text: "Velouté chou-fleur : découpe, puis deux fournées de 25 min." },
    { at: 34, text: "Bolognaise dinde-lentilles : découpe, mijotage (25 min), pâtes." },
    { at: 60, text: "Curry pois chiches-épinards : découpe, curry (20 min), riz." },
    { at: 75, text: "Pâtes saumon-poireaux : découpe, poireaux, saumon." },
    { at: 113, text: "Refroidissement : minuteur de 25 min." },
    { at: 138, text: "Portionnage : 10 boîtes étiquetées." },
    { at: 153, text: "Rangement : 7 repas au frigo, 3 au congélateur." },
  ],
} as const;

const ex = landingExample;
const shoppingCount = ex.shopping.reduce((n, g) => n + g.items.length, 0);

export const landingV2 = {
  nav: {
    label: "Navigation du site",
    example: "Un exemple",
    how: "Comment ça marche",
    features: "Fonctionnalités",
    households: "Foyers",
    pricing: "Tarifs",
    login: "Connexion",
    start: "Commencer",
  },
  hero: {
    sticker: "Application de batch cooking pour les familles",
    titlePlain: "Des soirées libérées,",
    titleMark: "moins de décisions autour des repas.",
    lead: "Fin Prêt organise les repas autour de la vraie semaine de ta famille : qui est à table à chaque repas, les repas à ne pas prévoir, le régime, l'équipement.",
    method:
      "La méthode, c'est le batch cooking : tu prépares plusieurs repas en une session, par exemple le dimanche. Ensuite, il reste à réchauffer, à assembler ou à décongeler.",
    cta: "Préparer ma semaine",
    secondary: "Voir un exemple de semaine",
    menuCard: {
      kicker: "Menu · mercredi soir",
      title: "Bolognaise dinde-lentilles",
      note: "Réchauffer au micro-ondes",
      portions: "3,25 portions",
    },
    sessionCard: {
      kicker: "Cette semaine d'exemple",
      big: String(ex.meals),
      caption: `repas, ${ex.recipes} recettes à cuisiner`,
    },
    coursesCard: {
      kicker: "Courses · par rayon",
      cells: [
        ["Articles", String(shoppingCount), ""],
        ["Rayons", String(ex.shopping.length), ""],
        ["Recettes", String(ex.recipes), "tone-success"],
      ],
    },
    stamp: "Batch cooking",
  },
  example: {
    id: "exemple",
    title: "Un exemple de semaine, pas à pas",
    lead: `Une semaine générée par Fin Prêt avec ses réglages par défaut. Foyer : ${ex.household}.`,
    stats: [
      {
        n: String(ex.meals),
        label: "repas à prévoir",
        hint: "5 déjeuners et 5 dîners, du lundi au vendredi",
      },
      {
        n: String(ex.recipes),
        label: "recettes",
        hint: "4 plats et 1 soupe : une recette couvre en général 2 repas",
      },
      {
        n: "26,25",
        label: "portions",
        hint: "1 portion = 1 adulte ; un enfant de 7 ans compte 0,75, de 4 ans 0,5",
      },
      {
        n: String(shoppingCount),
        label: "articles à acheter",
        hint: "hors produits du placard, en contenants du commerce",
      },
    ],
    recipesTitle: "Les repas, recette par recette",
    recipesLead:
      "Chaque boîte porte le jour et le repas. Au moment de manger, il reste un geste court, selon la recette.",
    portionsLabel: "portions",
    mealsLabel: "Repas couverts",
    gesturesLabel: "Le jour J",
    soupTag: "Soupe",
    shoppingTitle: "La liste de courses",
    shoppingSummary: `Voir les ${shoppingCount} articles par rayon`,
    shoppingNote:
      "Comprend aussi le goûter de la semaine (des pancakes aux fruits rouges), qui ne fait pas partie des 10 repas.",
    sessionTitle: "Aperçu de la session de préparation",
    sessionUnit: "min",
    sessionLead: `Dans cet exemple, l'application estime la session à ${hm(ex.sessionMinutes)} (${hm(ex.beginnerMinutes)} au niveau débutant).`,
    methodTitle: "Comment lire cet exemple",
    method: [
      "« 10 repas » désigne les occasions de repas du foyer : 5 déjeuners et 5 dîners, du lundi au vendredi. Ce ne sont pas 10 recettes ni 10 portions.",
      "Les portions comptent les personnes présentes à chaque repas : ici, les enfants ne mangent pas à la maison le midi.",
      `La durée est une estimation calculée à partir des durées indiquées dans les recettes, de ton équipement et de ton niveau : 5 min de mise en place, 25 min de refroidissement, 15 min de portionnage et 10 min de rangement, durées fixes. La vaisselle est proposée pendant le refroidissement ; le rangement de la cuisine après la session n'est pas compté.`,
      `Ce n'est pas une durée mesurée en cuisine. Sur 24 semaines générées pour ce foyer, l'estimation va de ${hm(ex.rangeMinutes[0])} à ${hm(ex.rangeMinutes[1])}. Le jour de la session se choisit dans les réglages : le dimanche n'est qu'un exemple.`,
    ],
    cta: "Préparer ma semaine",
  },
  catalogue: {
    label: "Le catalogue",
    items: [
      { n: "521", label: "recettes de repas" },
      { n: "150", label: "goûters" },
      { n: "35", label: "petits-déjeuners" },
    ],
    season: "De saison, toute l'année",
  },
  how: {
    title: "La méthode : le batch cooking",
    lead: "Cuisiner une fois pour plusieurs repas, au lieu de se demander chaque soir quoi faire. Fin Prêt s'occupe du menu, des courses et du déroulé.",
    steps: [
      {
        n: "01",
        title: "Qui est à table ?",
        text: "Adultes, enfants, cantine ou repas décalés, régime, allergies, équipement. Fin Prêt prévoit les repas du lundi au vendredi.",
      },
      {
        n: "02",
        title: "Un menu, des courses",
        text: "Peu de recettes pour beaucoup de repas, de saison. La liste est triée par rayon, en contenants du commerce.",
      },
      {
        n: "03",
        title: "Une session de préparation",
        text: "Le jour que tu choisis, par exemple le dimanche : étapes guidées, minuteurs, portionnage en boîtes.",
      },
      {
        n: "04",
        title: "Pendant la semaine",
        text: "Selon la recette, tu réchauffes, tu assembles (des pâtes à cuire, une sauce à ajouter) ou tu sors une boîte du congélateur la veille.",
      },
    ],
  },
  features: {
    title: "Fonctionnalités",
    items: [
      {
        tone: "menu",
        icon: "utensils",
        title: "Menu de saison",
        text: "Midis et soirs, du lundi au vendredi. Change un plat en un geste.",
      },
      {
        tone: "courses",
        icon: "basket",
        title: "Courses par rayon",
        text: "En contenants du commerce, cochées à plusieurs en temps réel, lisibles hors ligne.",
      },
      {
        tone: "session",
        icon: "timer",
        title: "Session guidée",
        text: "Étapes numérotées, minuteurs en parallèle, lisibles à un mètre.",
      },
      {
        tone: "stock",
        icon: "snowflake",
        title: "Rappels utiles",
        text: "Le plat du soir, et « avant de dormir » : ce qu'il faut sortir du congélateur pour le lendemain.",
      },
      {
        tone: "progres",
        icon: "sparkle",
        title: "Nos progrès",
        text: "Une série de semaines, un passeport de recettes sur la carte du monde.",
      },
      {
        tone: "",
        icon: "compass",
        title: "Régime et allergies",
        text: "Régime du foyer, allergènes, ingrédients refusés : les recettes concernées ne sont pas proposées.",
      },
    ],
  },
  households: {
    title: "Pour quel foyer ?",
    items: [
      {
        tone: "banane",
        tilt: false,
        tag: "Parents actifs",
        title: "Moins de décisions en semaine",
        text: "Les repas sont prévus à l'avance : le soir, il reste un geste court, pas un menu à inventer.",
      },
      {
        tone: "pink",
        tilt: true,
        tag: "Cantine et repas décalés",
        title: "Les quantités suivent qui mange",
        text: "Indique qui est à table à chaque repas, par exemple les enfants à la cantine le midi : les portions s'ajustent.",
      },
      {
        tone: "blue",
        tilt: false,
        tag: "Couple",
        title: "Juste ce qu'il faut pour deux",
        text: "Des quantités calculées pour le nombre de personnes présentes à chaque repas.",
      },
      {
        tone: "green",
        tilt: true,
        tag: "Végétarien",
        title: "Varié, sans viande ni ennui",
        text: "Filtres régime et allergènes : le menu s'y plie, la liste aussi.",
      },
    ],
  },
  pricing: {
    title: "Tarifs",
    lead: "Deux formules, le même Fin Prêt : menu de saison, courses, session guidée, rappels et progrès.",
    monthly: {
      label: "Au mois",
      price: "5,99 €",
      per: "/ mois",
      note: "Facturé chaque mois.",
      cta: "Choisir le mois",
    },
    yearly: {
      label: "À l'année",
      badge: "−30 %",
      price: "49,99 €",
      per: "/ an",
      note: "Soit 4,17 € par mois : 21,89 € d'économie sur l'année.",
      cta: "Choisir l'année",
    },
    asso: {
      kicker: "Associations de parents d'élèves",
      text: "Tu fais partie d'une association ? Découvre comment Fin Prêt travaille avec les écoles.",
      cta: "Voir la page associations",
    },
  },
  faq: {
    title: "Questions",
    items: [
      {
        q: "Qu'est-ce que le batch cooking ?",
        a: "C'est cuisiner en une session plusieurs repas de la semaine, puis les conserver au frigo ou au congélateur. Fin Prêt compose le menu, prépare la liste de courses et te guide pendant la session.",
      },
      {
        q: "« 10 repas », ça veut dire 10 recettes ?",
        a: "Non. Les 10 repas sont les déjeuners et dîners du lundi au vendredi. Une recette couvre en général deux repas : avec les réglages par défaut, une semaine compte environ 5 recettes. Les portions dépendent des personnes présentes à chaque repas.",
      },
      {
        q: "Combien de temps dure la session ?",
        a: `Ça dépend de la semaine. L'application estime la durée à partir des recettes, de ton équipement et de ton niveau, et t'avertit si elle dépasse la durée maximale que tu as fixée. Dans notre exemple, l'estimation est de ${hm(ex.sessionMinutes)}. Ce n'est pas une durée mesurée.`,
      },
      {
        q: "Faut-il cuisiner le dimanche ?",
        a: "Non, le dimanche est un exemple. Tu choisis le jour de ta session dans les réglages. Une session reste une seule séance : elle n'est pas découpée en plusieurs.",
      },
      { q: "Et si on mange dehors un soir ?", a: "Retire le repas : la liste et la session s'ajustent." },
      {
        q: "Ça marche pour un foyer végétarien ?",
        a: "Oui. Choisis tes filtres régime et allergènes, le menu s'y plie.",
      },
      {
        q: "Et sans réseau au supermarché ?",
        a: "Ta liste reste lisible hors ligne. Pour cocher un article, il faut du réseau.",
      },
      { q: "Combien ça coûte ?", a: "5,99 € par mois, ou 49,99 € par an (soit 4,17 € par mois)." },
    ],
  },
  finalCta: { title: "Prêt pour ta première semaine ?", cta: "Préparer ma semaine" },
  examples: {
    title: "D'autres exemples de semaine",
    lead: "Avant de te connecter, regarde à quoi ressemble une semaine : les dîners, les portions, la liste de courses et l'organisation.",
    items: [
      {
        href: "/menu-de-la-semaine/avec-liste-de-courses",
        title: "Menu de la semaine avec liste de courses",
        text: "Cinq dîners pour deux adultes, avec les courses rayon par rayon.",
      },
      {
        href: "/menu-de-la-semaine/2-adultes-2-enfants",
        title: "Menu pour 2 adultes et 2 enfants",
        text: "Comment les portions des enfants changent les quantités à acheter.",
      },
      {
        href: "/menu-de-la-semaine/vegetarien",
        title: "Menu de la semaine végétarien",
        text: "Cinq dîners sans viande ni poisson, œufs et laitages autorisés.",
      },
    ],
  },
  footer: {
    nav: "Pied de page",
    legal: "Informations légales",
    links: [{ href: "/associations", label: "Associations" }],
    /** Pages publiques du catalogue : liens toujours actifs, pour que les robots les découvrent depuis l'accueil. */
    explore: [
      { href: "/recettes", label: "Recettes" },
      { href: "/menus", label: "Menus de la semaine" },
      { href: "/batch-cooking", label: "Guides batch cooking" },
    ],
    legalLinks: [
      { href: "/cgu", label: "CGU" },
      { href: "/cgv", label: "CGV" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
} as const;
