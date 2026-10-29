/** Textes de la landing (maquette v2.1). Tutoiement, espaces insécables avant « ? : ; ! ». */
export const landingV2 = {
  nav: {
    label: "Navigation du site",
    how: "Comment ça marche",
    features: "Fonctionnalités",
    households: "Foyers",
    pricing: "Tarifs",
    login: "Connexion",
    start: "Commencer",
  },
  hero: {
    sticker: "10 repas · 2 h 30",
    titlePlain: "2 h 30 le dimanche.",
    titleMark: "10 repas dans la semaine.",
    lead: "Fin Prêt compose un menu de saison pour ta famille, prépare la liste de courses et te guide minute par minute pendant une seule session. Le reste de la semaine, tu réchauffes.",
    cta: "Préparer ma semaine",
    secondary: "Comment ça marche",
    menuCard: { kicker: "Menu · mardi soir", title: "Tajine de poulet au citron", country: "Maroc", time: "50 min" },
    sessionCard: { kicker: "Session du dimanche", time: "2:30", caption: "pour 10 repas" },
    coursesCard: {
      kicker: "Courses · lentilles corail",
      need: "Besoin",
      bought: "Acheté",
      left: "Reste",
      grams: "500 g",
      zero: "0",
    },
    stamp: "Passeport · Italie",
  },
  catalogue: {
    label: "Le catalogue",
    items: [
      { n: "184", label: "repas" },
      { n: "35", label: "goûters" },
      { n: "25", label: "petits-déjeuners" },
    ],
    season: "De saison, toute l'année",
  },
  how: {
    title: "Comment ça marche",
    steps: [
      { n: "01", title: "Qui est à table ?", text: "Adultes, enfants, régimes, allergies. Fin Prêt compose 10 repas de saison." },
      { n: "02", title: "Les courses", text: "Une liste triée par rayon. Tu notes ce que tu achètes, elle calcule ce qu'il reste." },
      { n: "03", title: "La session", text: "Dimanche, 2 h 30 guidées pas à pas, minuteurs compris." },
      { n: "04", title: "La semaine", text: "Tu réchauffes. Fin Prêt te dit quoi sortir du congélateur, et quand." },
    ],
  },
  features: {
    title: "Fonctionnalités",
    items: [
      { tone: "menu", icon: "utensils", title: "Menu de saison", text: "Midis, soirs, week-end. Change un plat en un geste." },
      { tone: "courses", icon: "basket", title: "Courses réelles", text: "Besoin, acheté, reste. Un produit introuvable ? Le menu s'adapte." },
      { tone: "session", icon: "timer", title: "Session guidée", text: "Étapes numérotées, minuteurs en parallèle, lisibles à un mètre." },
      { tone: "stock", icon: "snowflake", title: "Congélateur", text: "Chaque plat rangé par contenant, avec le rappel « à sortir demain »." },
      { tone: "progres", icon: "sparkle", title: "Nos progrès", text: "Une série de semaines, un passeport de recettes sur la carte du monde." },
      { tone: "", icon: "compass", title: "Adapter mon menu", text: "Il manque un ingrédient ? Jusqu'à 3 propositions, et tu peux annuler." },
    ],
  },
  households: {
    title: "Pour quel foyer ?",
    items: [
      { tone: "banane", tilt: false, tag: "Parents actifs", title: "Les soirs de semaine sont réglés", text: "Une session le dimanche, plus de « on mange quoi ce soir ? » à 19 h." },
      { tone: "pink", tilt: true, tag: "Garde alternée", title: "Une semaine sur deux, sans gâchis", text: "Indique les jours où les enfants sont là, les quantités suivent." },
      { tone: "blue", tilt: false, tag: "Couple", title: "Juste ce qu'il faut pour deux", text: "Des portions réalistes et des restes qui finissent au congélateur." },
      { tone: "green", tilt: true, tag: "Végétarien", title: "Varié, sans viande ni ennui", text: "Filtres régime et allergènes : le menu s'y plie, la liste aussi." },
    ],
  },
  pricing: {
    title: "Tarifs",
    lead: "Deux formules, le même Fin Prêt : menu de saison, courses, session guidée, congélateur et progrès.",
    monthly: { label: "Au mois", price: "5,99 €", per: "/ mois", note: "Facturé chaque mois.", cta: "Choisir le mois" },
    yearly: {
      label: "À l'année",
      badge: "−30 %",
      price: "49,99 €",
      per: "/ an",
      note: "Soit 4,17 € par mois : 21,89 € d'économie sur l'année.",
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
      { q: "Combien de temps dure la session ?", a: "Environ 2 h 30 pour 10 repas. La session te dit quoi faire, dans quel ordre, et lance les minuteurs." },
      { q: "Et si on mange dehors un soir ?", a: "Retire le repas : la liste et la session s'ajustent. Le plat peut aussi partir au congélateur." },
      { q: "Ça marche pour un foyer végétarien ?", a: "Oui. Choisis tes filtres régime et allergènes, le menu s'y plie." },
      { q: "Et sans réseau au supermarché ?", a: "Ta liste reste lisible hors ligne. Les achats se saisissent au retour du réseau." },
      { q: "Combien ça coûte ?", a: "5,99 € par mois, ou 49,99 € par an (soit 4,17 € par mois)." },
    ],
  },
  finalCta: { title: "Prêt pour dimanche ?", cta: "Préparer ma semaine" },
  footer: {
    nav: "Pied de page",
    legal: "Informations légales",
    links: [{ href: "/associations", label: "Associations" }],
    legalLinks: [
      { href: "/cgu", label: "CGU" },
      { href: "/cgv", label: "CGV" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
} as const;
