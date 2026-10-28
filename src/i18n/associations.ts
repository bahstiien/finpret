import type { IconName } from "@/components/landing/Icon";

/**
 * Textes de la landing /associations, de la page satellite et des pages légales (SPEC_JANVIER §8 bis A).
 * Les textes de référence de la spec sont repris tels quels ; vouvoiement pour les bureaux d'association.
 */
export const SITE_URL = "https://finpret.app";

/** Texte accompagné de son icône (liste d'étapes, liste d'avantages). */
type Illustrated = { icon: IconName; text: string };

export const associationsFr = {
  meta: {
    title: "Financer votre APE sans vendre de chocolats | Fin Prêt",
    description:
      "Fin Prêt aide les familles de votre école à organiser leurs repas et verse 8 € par abonné à votre APE chaque année. Sans stock ni commande.",
    ogAlt: "Fin Prêt : financez les projets de votre APE, sans vendre de chocolats",
  },
  nav: {
    label: "Navigation",
    home: "Fin Prêt",
    homeAria: "Fin Prêt, accueil",
    associations: "Associations",
    how: "Comment ça marche",
    signup: "Créer le compte",
    skip: "Aller au contenu",
    open: "Ouvrir le menu",
    close: "Fermer le menu",
  },
  hero: {
    proofs: ["Sans stock", "Sans engagement", "Données hébergées en Europe"],
    title: "Financez les projets de votre APE, sans vendre de chocolats",
    lead: "Fin Prêt aide les familles de votre école à organiser leurs repas de la semaine. Votre association reçoit 8 € pour chaque famille abonnée, chaque année.",
    cta: "Créer le compte de notre association",
    secondary: "Voir comment ça marche",
    visualAlt: "Capture du programme du jour de Fin Prêt avec le menu de la cantine et l'alerte doublon",
    cantine: "Cantine : poulet, riz",
    alert: "Même base qu'à la cantine ce midi : riz. Tu peux changer le plat du soir.",
    today: "Aujourd'hui",
  },
  // Phrase de fond de la page : s'allume mot à mot au défilement (TaglineReveal).
  tagline:
    "Une semaine de repas plus simple pour les familles. Un financement régulier pour les projets de votre association. Aucune commande à gérer.",
  problem: {
    title: "Les ventes de chocolats, ça va un moment",
    cards: [
      "Des heures de bénévolat pour gérer les commandes",
      "Du stock, des livraisons, des impayés",
      "Toujours les mêmes familles qui s'investissent",
    ],
  },
  how: {
    id: "comment",
    title: "Une action qui tourne toute seule",
    // L'icône voyage avec son texte : réordonner une liste ne désaccorde plus le dessin.
    steps: [
      { icon: "users", text: "Votre bureau crée le compte de l'association (5 minutes)" },
      { icon: "share", text: "Vous partagez votre code aux familles avec le kit fourni" },
      { icon: "calendar", text: "Un bénévole publie les menus de la cantine chaque mois (10 minutes)" },
      { icon: "check", text: "Vous recevez votre reversement chaque trimestre" },
    ] satisfies Illustrated[],
  },
  families: {
    title: "Un vrai service pour les parents",
    items: [
      { icon: "utensils", text: "Les menus de la cantine sur leur téléphone" },
      { icon: "timer", text: "Une alerte quand le dîner ressemble au déjeuner" },
      { icon: "pot", text: "Une semaine de repas préparée en une session le dimanche" },
      { icon: "basket", text: "Une liste de courses partagée" },
    ] satisfies Illustrated[],
    benefit: "Avantage réservé : 30 jours d'essai et 39,99 € la première année au lieu de 49,99 €.",
  },
  simulator: {
    title: "Combien votre association peut-elle recevoir ?",
    families: "Nombre de familles dans l'école",
    share: "Part des familles qui s'abonnent",
    result: (amount: string) => `Environ ${amount} par an pour votre association`,
    note: "Estimation indicative : le reversement dépend des abonnements réellement souscrits",
  },
  zero: {
    title: "Zéro logistique",
    items: [
      "Pas de stock",
      "Pas de commandes à collecter",
      "Pas d'argent à manipuler",
      "Aucune donnée de famille à gérer",
    ],
  },
  trust: {
    title: "Pensé pour les associations",
    items: [
      "Vos familles restent anonymes (vous ne voyez que des chiffres globaux)",
      "Communication uniquement par vos canaux, jamais par l'école",
      "Pas de publicité dans l'app",
      "Données hébergées en Europe",
      "Contrat de partenariat clair, sans engagement de durée",
    ],
  },
  testimonial: {
    // Témoignage de l'association pilote : à renseigner après la bêta ; la section reste masquée tant que c'est vide.
    quote: "",
    author: "",
  },
  faq: {
    title: "Vos questions",
    items: [
      {
        q: "Est-ce que l'école doit donner son accord ?",
        a: "Non, c'est votre association qui recommande Fin Prêt, par ses propres canaux (lettre d'information, groupes de parents, événements). Pour une diffusion dans les cartables ou un affichage dans l'école, il faut l'accord du directeur.",
      },
      {
        q: "Combien de temps ça demande aux bénévoles ?",
        a: "Environ 5 minutes pour créer le compte, puis 10 minutes par mois pour publier les menus de la cantine.",
      },
      {
        q: "Comment est calculé le reversement ?",
        a: "8 € par abonnement annuel et 0,50 € par mois d'abonnement mensuel, pour chaque famille inscrite avec votre code, versés chaque trimestre dès 20 €.",
      },
      {
        q: "Voit-on qui s'est abonné ?",
        a: "Non. Vous voyez le nombre de familles et le montant du reversement, jamais les noms. En dessous de 5 familles, les chiffres sont regroupés.",
      },
      {
        q: "Faut-il un statut particulier ?",
        a: "Votre association doit être déclarée (numéro RNA ou SIREN). Vérifiez avec votre trésorier le traitement fiscal de ces recettes.",
      },
      {
        q: "Et si nous voulons arrêter ?",
        a: "Le partenariat est sans engagement de durée : vous pouvez l'arrêter à tout moment, les reversements dus restent versés.",
      },
    ],
  },
  final: {
    title: "Prêts à lancer votre action ?",
    cta: "Créer le compte de notre association",
    lead: "Pas encore prêts ? Recevez la présentation par e-mail",
  },
  lead: {
    title: "Recevez la présentation par e-mail",
    intro: "Pour en parler en réunion de bureau : une fiche de présentation de deux pages, par e-mail.",
    name: "Votre nom",
    email: "Votre e-mail",
    association: "Nom de l'association",
    school: "École",
    city: "Commune",
    families: "Nombre approximatif de familles (facultatif)",
    consent:
      "J'accepte que Fin Prêt me contacte au sujet de ce partenariat et me conserve ces informations le temps de la discussion.",
    submit: "Recevoir la présentation",
    sent: "C'est envoyé. Regardez votre boîte de réception (et vos courriers indésirables).",
    errors: {
      invalid: "Vérifiez les champs : nom, e-mail, association et le consentement sont nécessaires.",
      tooMany: "Trop de demandes depuis cette adresse. Réessayez dans une heure.",
      generic: "La demande n'a pas pu être envoyée. Réessayez dans un instant.",
    },
  },
  footer: {
    associations: "Associations de parents",
    howItWorks: "Comment ça marche pour une association",
    legal: "Mentions légales",
    cgu: "Conditions d'utilisation",
    cgv: "Conditions de vente",
    privacy: "Confidentialité",
    partnership: "Partenariat associations",
    contact: "bonjour@finpret.app",
  },
  breadcrumbs: { home: "Accueil", associations: "Associations", how: "Comment ça marche" },
};

export type HowItWorksSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  ordered?: string[];
  bullets?: string[];
};

/** Contenu long (environ 1 200 mots) de la page satellite /associations/comment-ca-marche, ciblée sur la longue traîne. */
export const howItWorksFr = {
  meta: {
    title: "Comment financer une sortie scolaire avec votre APE | Fin Prêt",
    description:
      "Les étapes, le calcul du reversement et les règles de communication pour financer les projets de votre association de parents avec Fin Prêt.",
  },
  title: "Comment financer une sortie scolaire avec l'action Fin Prêt",
  lead: "Vous cherchez une idée de projet pour votre APE, un moyen de financer une sortie scolaire ou une alternative à la vente de chocolats ? Voici, étape par étape, comment fonctionne le partenariat avec Fin Prêt, ce que cela demande aux bénévoles et comment est calculé le reversement.",
  sections: [
    {
      id: "principe",
      title: "Le principe en deux minutes",
      paragraphs: [
        "Fin Prêt est une application qui aide les familles à organiser leurs repas de la semaine : un menu de saison prêt en un clic, une liste de courses partagée entre les parents et une session de préparation guidée le dimanche. Pour les parents d'élèves, elle affiche aussi le menu de la cantine de l'école et prévient quand le dîner ressemble au déjeuner.",
        "Votre association recommande l'application à ses familles avec un code. Chaque famille qui s'abonne avec ce code finance les projets de l'association : 8 € par abonnement annuel et 0,50 € par mois d'abonnement mensuel. Il n'y a rien à acheter, rien à stocker, rien à livrer et aucun argent à manipuler.",
        "C'est une action de financement régulière plutôt qu'un événement ponctuel : une fois lancée en septembre ou en janvier, elle continue à rapporter au fil de l'année, sans mobiliser les mêmes bénévoles à chaque fois.",
      ],
    },
    {
      id: "etapes",
      title: "Les quatre étapes pour votre bureau",
      ordered: [
        "Créez le compte de l'association. Il faut le nom de l'association, son numéro RNA ou SIREN, l'adresse e-mail du bureau, le nom du responsable et la liste des écoles concernées. Cela prend environ cinq minutes.",
        "Attendez la validation. Nous vérifions le numéro et l'adresse e-mail, en général sous un à deux jours ouvrés. Vous recevez un e-mail avec votre code, de la forme APE-NOMDEVOTREASSOCIATION, que vous pouvez modifier une fois.",
        "Partagez votre code aux familles. Le kit fourni contient une fiche de deux pages avec un QR code, un e-mail type et un message prêt à coller dans les groupes de parents.",
        "Publiez les menus de la cantine chaque mois. Importez le PDF de la mairie ou saisissez les repas à la main, vérifiez, puis publiez : dix minutes par mois suffisent.",
      ],
    },
    {
      id: "familles",
      title: "Ce que les familles y gagnent",
      paragraphs: [
        "Les parents qui s'inscrivent avec votre code bénéficient de trente jours d'essai gratuit, puis d'un abonnement annuel à 39,99 € la première année au lieu de 49,99 €. L'abonnement mensuel reste à 5,99 €.",
        "Au quotidien, ils retrouvent les menus de la cantine sur leur téléphone, une alerte lorsque le plat du soir a la même base que le repas du midi, un menu de la semaine préparé en une session, et une liste de courses que les deux parents cochent en même temps, même en magasin.",
        "Les familles qui n'ont pas pris d'abonnement gardent la liste de courses, la session guidée et la découverte des recettes. Les menus de la cantine restent gratuits pour toutes les familles rattachées à votre association.",
      ],
    },
    {
      id: "calcul",
      title: "Comment est calculé le reversement",
      paragraphs: [
        "Chaque fois qu'une famille inscrite avec votre code règle un abonnement annuel, 8 € sont ajoutés à votre compte, à la première souscription comme à chaque renouvellement. Chaque mois d'abonnement mensuel payé ajoute 0,50 €. Si un paiement est remboursé ou contesté, la ligne correspondante est annulée.",
        "À la fin de chaque trimestre, nous additionnons les lignes de votre association. Si le total atteint 20 €, il est versé sur l'IBAN que vous avez enregistré, accompagné d'un relevé en PDF envoyé par e-mail. En dessous de 20 €, le montant est reporté au trimestre suivant : rien n'est perdu.",
        "Pour estimer ce que votre association peut recevoir, multipliez le nombre de familles de l'école par la part qui s'abonne, puis par 8 €. Avec 200 familles et 15 % d'abonnés, l'estimation est de 240 € par an. Il s'agit d'une estimation indicative : le reversement dépend des abonnements réellement souscrits.",
      ],
    },
    {
      id: "vie-privee",
      title: "Vos familles restent anonymes",
      paragraphs: [
        "L'espace association affiche uniquement des chiffres globaux : le nombre de familles inscrites, le nombre d'abonnés mensuels et annuels, le reversement du trimestre et le total versé. Vous ne voyez jamais de nom, d'adresse e-mail ni de menu de famille. En dessous de cinq familles, les chiffres sont regroupés et affichés « moins de 5 ».",
        "L'association ne reçoit et ne demande aucune donnée personnelle des familles. Les données sont hébergées en Europe et Fin Prêt ne diffuse aucune publicité.",
      ],
    },
    {
      id: "communication",
      title: "Les règles de communication",
      bullets: [
        "Communiquez par les canaux de l'association : lettre d'information, groupes de parents, réunions, événements.",
        "Pour une diffusion dans les cartables ou un affichage dans l'école, demandez l'accord du directeur : l'école n'est pas partie prenante de l'action.",
        "Ne vous adressez jamais aux enfants.",
        "N'exigez ni ne collectez aucune information personnelle auprès des familles.",
      ],
    },
    {
      id: "calendrier",
      title: "Un calendrier type sur l'année",
      bullets: [
        "Septembre et janvier : lancement auprès des familles, au moment où les habitudes se prennent.",
        "Chaque fin de mois : publication des menus de la cantine du mois suivant.",
        "Fin de trimestre : relevé de reversement et virement.",
      ],
    },
    {
      id: "questions",
      title: "Les questions que les bureaux nous posent",
      paragraphs: [
        "L'école doit-elle donner son accord ? Non : c'est votre association qui recommande Fin Prêt. L'accord du directeur n'est nécessaire que pour une diffusion dans les cartables ou un affichage dans l'école.",
        "Faut-il un statut particulier ? Votre association doit être déclarée, avec un numéro RNA ou SIREN. Vérifiez avec votre trésorier le traitement fiscal de ces recettes.",
        "Et si nous voulons arrêter ? Le partenariat est sans engagement de durée. Vous pouvez l'arrêter à tout moment, et les reversements dus restent versés.",
      ],
    },
  ] satisfies HowItWorksSection[] as HowItWorksSection[],
  cta: "Créer le compte de notre association",
  back: "Retour à la présentation",
};

/** Pages légales : gabarits uniquement, le texte juridique est à fournir (TODO(juriste)). */
export const legalFr = {
  todo: "TODO(juriste) : texte juridique à fournir avant l'ouverture. Aucun contenu juridique n'est inventé dans ce gabarit.",
  pages: {
    "mentions-legales": {
      title: "Mentions légales",
      sections: ["Éditeur du site", "Directeur de la publication", "Hébergeur", "Contact"],
    },
    cgu: {
      title: "Conditions générales d'utilisation",
      sections: [
        "Objet",
        "Comptes et foyers",
        "Utilisation du service",
        "Responsabilités",
        "Évolution des conditions",
      ],
    },
    cgv: {
      title: "Conditions générales de vente",
      sections: [
        "Offres et prix",
        "Essai gratuit",
        "Paiement et facturation",
        "Droit de rétractation et renonciation expresse",
        "Résiliation",
        "Remboursement",
      ],
    },
    confidentialite: {
      title: "Politique de confidentialité",
      sections: [
        "Données collectées",
        "Données des enfants",
        "Finalités et bases légales",
        "Durées de conservation",
        "Vos droits (accès, export, suppression)",
        "Sous-traitants et hébergement",
      ],
    },
    "partenariat-associations": {
      title: "Contrat de partenariat avec les associations",
      sections: [
        "Objet du partenariat",
        "Code d'association et avantage famille",
        "Reversements",
        "Communication et règles à respecter",
        "Données et confidentialité",
        "Durée et fin du partenariat",
      ],
    },
  },
} as const;

export type LegalSlug = keyof typeof legalFr.pages;
