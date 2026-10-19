/** Textes de l'interface (CLAUDE.md, règle 5) : tutoiement, ton chaleureux et direct. */
import { engineFr } from "./engine";

export const fr = {
  app: {
    name: "Menu de la semaine",
    shortName: "Menu",
    description: "Tes repas de la semaine, la liste de courses et la session de batch cooking du dimanche.",
  },
  home: {
    eyebrow: "Batch cooking en famille",
    title: "Une session le dimanche, une semaine sans y penser.",
    lead: "Chaque semaine, on compose tes midis et tes soirs, on fait la liste de courses en vrais contenants et on te guide pendant la session.",
    features: [
      {
        title: "Le menu de la semaine",
        text: "10 repas équilibrés, de saison, qui tiennent compte de ton frigo.",
      },
      { title: "Des courses partagées", text: "Une liste par rayon, cochée à plusieurs, en temps réel." },
      { title: "Une session guidée", text: "Un planning étape par étape, avec les minuteurs." },
    ],
    login: "Se connecter",
  },
  /** Page d'accueil publique (finpret.app). Textes passés par `nb()` au rendu pour la typographie française. */
  landing: {
    metaTitle: "Fin Prêt · Le dimanche, tu cuisines. La semaine est fin prête.",
    metaDescription:
      "Fin Prêt compose tes menus, calcule tes courses en vrais contenants et te guide pendant la session du dimanche. 10 repas en 2 h 30, plus de charge mentale en semaine.",
    skip: "Aller au contenu",
    nav: {
      label: "Navigation principale",
      how: "Comment ça marche",
      features: "Fonctionnalités",
      faq: "Questions",
      login: "Se connecter",
    },
    hero: {
      eyebrow: "Batch cooking en famille",
      titleLine1: "Le dimanche, tu cuisines.",
      titleLine2: "La semaine est fin prête.",
      lead: "Fin Prêt compose tes menus, calcule tes courses et te guide pendant la session. 10 repas en 2 h 30, et plus de charge mentale en semaine.",
      cta: "Préparer ma semaine",
      secondary: "Voir comment ça marche",
      reassurance: "5 questions, 5 minutes, et ta première semaine est prête.",
      phoneLabel:
        "Écran Menu de Fin Prêt : le programme du jeudi, « Ce soir : cuis 200 g de pâtes » et « Sors le chili du congélateur ».",
      notification: {
        time: "17 h 30",
        title: "Ce soir : bolognaise",
        text: "Cuis 200 g de pâtes complètes, la sauce est prête.",
      },
    },
    proof: {
      origin: "Né d’un usage réel : une famille de quatre qui l’utilise chaque semaine.",
      stats: [
        { value: "2 h 30", label: "de session le dimanche" },
        { value: "10", label: "repas prêts pour la semaine" },
        { value: "180", label: "recettes de saison" },
        { value: "19", label: "cuisines du monde" },
      ],
    },
    benefits: {
      title: "Cuisine une fois, souffle toute la semaine.",
      items: [
        {
          kicker: "Le menu",
          title: "Fini la charge mentale",
          quote: "On mange quoi ce soir ? Fin Prêt a déjà la réponse.",
          text: "Ton menu de la semaine se compose en un geste : de saison, varié, sans deux plats de pâtes le même jour. Chaque soir, une notification te dit quoi cuire.",
        },
        {
          kicker: "La session",
          title: "Une seule session",
          quote: "2 h 30 le dimanche, 10 repas pour la semaine.",
          text: "Un planning étape par étape, des minuteurs, le four et les plaques bien occupés, et le portionnage de chaque boîte. Tu n’as qu’à suivre.",
        },
        {
          kicker: "Les courses",
          title: "Des courses justes",
          quote: "Juste ce qu’il faut, en vrais paquets du supermarché.",
          text: "Une liste triée par rayon, calculée en contenants réels, avec ton garde-manger déjà déduit. Toute la famille coche sur la même liste.",
        },
      ],
    },
    how: {
      title: "De zéro à la semaine fin prête",
      lead: "Une question par écran : quoi manger, quoi acheter, quoi faire maintenant.",
      steps: [
        {
          title: "Dis qui est à table",
          text: "5 questions : qui mange, ce qu’il faut éviter, ton équipement, ton rythme. Garde alternée, cantine, allergies : tout est pris en compte.",
        },
        {
          title: "Prépare ta semaine",
          text: "Un bouton, 10 repas : midis et soirs du lundi au vendredi, des idées pour le week-end. Un plat ne te plaît pas ? Change-le.",
        },
        {
          title: "Cuisine le dimanche",
          text: "Une étape à la fois : l’heure, l’appareil, les tâches à cocher, le minuteur à lancer. Tu gardes les mains dans la cuisine.",
        },
        {
          title: "Mange sans y penser",
          text: "Chaque jour, le programme : « Ce soir : bolognaise. Cuis 200 g de pâtes. » Et ce qu’il faut sortir du congélateur pour demain.",
        },
      ],
    },
    showcase: {
      title: "Ce que tu vois dans ta cuisine",
      items: [
        {
          kicker: "Le menu",
          title: "Ta semaine d’un coup d’œil",
          text: "Midis, soirs, week-end. Tu changes un plat, tu le déplaces ou tu le retires : le reste de la semaine suit.",
          label:
            "Écran Menu de Fin Prêt : la grille des repas à prévoir et le plat star de la semaine, un chili con carne.",
        },
        {
          kicker: "Les courses",
          title: "Une liste partagée",
          text: "Triée par rayon, en vrais paquets. Quelqu’un coche le lait au supermarché, ton écran se met à jour.",
          label:
            "Écran Courses de Fin Prêt : une liste triée par rayon, 12 articles cochés sur 31, et le placard à vérifier.",
        },
        {
          kicker: "La session",
          title: "Les mains dans la cuisine",
          text: "L’heure se lit à un mètre, les minuteurs restent en haut de l’écran, le bouton « Étape suivante » passe au vert quand tout est coché.",
          label:
            "Écran Session de Fin Prêt : étape 5 sur 12, « Enfourne la butternut », avec les tâches à cocher et un minuteur de 25 minutes.",
        },
      ],
    },
    features: {
      title: "Tout le cycle, au même endroit",
      lead: "Menu, courses, session, suivi quotidien et stock : Fin Prêt orchestre tout, pour que tu n’aies plus rien à jongler.",
      items: [
        {
          tone: "pink",
          icon: "users",
          title: "Toute la famille, même liste",
          text: "Chaque coche, chaque ajout apparaît en quelques secondes sur les autres téléphones. Pas de réseau au supermarché ? Tout se synchronise au retour de la connexion.",
        },
        {
          tone: "green",
          icon: "snowflake",
          title: "La réserve du congélateur",
          text: "Double un plat, congèle-le, retrouve-le. Fin Prêt s’en sert en priorité et te dit quand le sortir pour le lendemain.",
        },
        {
          tone: "cream",
          icon: "link",
          title: "Tes propres recettes",
          text: "Colle le lien d’une recette trouvée sur le web : Fin Prêt la lit, rapproche les ingrédients et te demande de vérifier avant de l’ajouter à ton menu.",
        },
        {
          tone: "blue",
          icon: "calendar",
          title: "Chacun son rythme",
          text: "Garde alternée, repas à la cantine, soirs décalés : tu dis qui est là à quel repas, et les portions suivent.",
        },
        {
          tone: "violet",
          icon: "shield",
          title: "Tous les régimes",
          text: "Omnivore, flexitarien, végétarien, pescétarien. Tu coches les allergènes et les ingrédients refusés, et les recettes concernées ne sont pas proposées.",
        },
        {
          tone: "surface",
          icon: "phone",
          title: "Sur téléphone, tablette, frigo",
          text: "Pas de store : tu ajoutes Fin Prêt à ton écran d’accueil. Les notifications arrivent au bon moment, et une page A4 s’imprime pour le frigo.",
        },
      ],
    },
    audiences: {
      title: "Fin Prêt s’adapte à ta maison",
      items: [
        {
          label: "Parents actifs",
          text: "Ne plus penser aux repas chaque soir, et partager l’organisation à deux.",
        },
        {
          label: "Garde alternée",
          text: "Des quantités qui suivent les semaines avec ou sans les enfants.",
        },
        {
          label: "Couple sans enfant",
          text: "Varier, manger protéiné et gaspiller moins.",
        },
        {
          label: "Foyer végétarien",
          text: "Des menus équilibrés et protéinés, sans tofu imposé.",
        },
      ],
    },
    faq: {
      title: "Tes questions",
      items: [
        {
          q: "Combien de temps dure la session du dimanche ?",
          a: "En général 2 h 30 pour 10 repas. Tu fixes la durée maximale pendant les 5 questions du départ, et Fin Prêt compose la session pour que ça tienne. Tu débutes en cuisine ? On ajoute 20 % de marge à chaque étape.",
        },
        {
          q: "Et si on a des allergies ou un régime particulier ?",
          a: "Tu choisis le régime du foyer, tu coches les allergènes et tu écartes les ingrédients refusés : les recettes concernées ne sont pas proposées. Fin Prêt t’aide à filtrer, mais en cas d’allergie, vérifie toujours les étiquettes.",
        },
        {
          q: "Ça marche en garde alternée ou avec la cantine ?",
          a: "Oui. Tu indiques qui mange à quel repas, en semaine A ou en semaine B, et les portions suivent. Pour la cantine, tu renseignes le menu de ton enfant et Fin Prêt te prévient s’il y a déjà des pâtes ce soir.",
        },
        {
          q: "Je peux ajouter mes propres recettes ?",
          a: "Oui. Colle le lien d’une recette : Fin Prêt la lit, rapproche les ingrédients et te demande de vérifier avant de l’ajouter. Elle reste privée à ton foyer et entre dans ton menu comme les autres. Tu peux aussi la saisir à la main.",
        },
        {
          q: "Faut-il installer une application ?",
          a: "Pas de store : tu ajoutes Fin Prêt à l’écran d’accueil depuis ton navigateur. Elle marche sur téléphone, tablette et ordinateur, et la liste de courses reste consultable sans réseau.",
        },
        {
          q: "Combien de personnes peuvent partager un foyer ?",
          a: "Jusqu’à 8 comptes et 10 personnes qui mangent par foyer. Un même compte peut appartenir à plusieurs foyers, jusqu’à 5 : pratique pour les grands-parents ou la garde alternée.",
        },
        {
          q: "Qu’est-ce qui arrive à mes données ?",
          a: "Elles sont hébergées dans l’Union européenne. Tu peux tout exporter dans un fichier, ou supprimer ton compte quand tu veux.",
        },
      ],
    },
    finalCta: {
      title: "Ta semaine, fin prête.",
      text: "Cuisine une fois le dimanche. Mange bien toute la semaine.",
      cta: "Préparer ma semaine",
    },
    footer: {
      signature: "À table !",
      contact: "bonjour@finpret.app",
      team: "L’équipe Fin Prêt",
    },
  },
  login: {
    title: "Connexion",
    lead: "Pas de mot de passe : on t'envoie un lien par e-mail.",
    email: "Ton adresse e-mail",
    emailPlaceholder: "prenom@exemple.fr",
    submit: "Recevoir le lien",
    sent: (email: string) => `C'est parti ! Ouvre le lien envoyé à ${email} depuis cet appareil.`,
    or: "ou",
    apple: "Continuer avec Apple",
    google: "Continuer avec Google",
    invalidEmail: "Cette adresse e-mail ne semble pas valide.",
    failed: "La connexion n'a pas abouti. Réessaie dans un instant.",
    providerUnavailable: "Ce mode de connexion n'est pas encore disponible.",
    linkExpired: "Ce lien de connexion a expiré ou a déjà servi. Demande-en un nouveau.",
  },
  household: {
    createTitle: "Crée ton foyer",
    createLead: "Le foyer, c'est la maison : vous y partagez le menu, les courses et le stock.",
    nameLabel: "Nom du foyer",
    namePlaceholder: "La maison",
    nameInvalid: "Donne un nom de 1 à 60 caractères.",
    create: "Créer le foyer",
    joinHint: "Tu as reçu une invitation ? Ouvre simplement le lien qu'on t'a envoyé.",
    switchLabel: "Foyer actif",
    switch: "Changer",
  },
  roles: {
    admin: "Administrateur",
    member: "Membre",
    viewer: "Lecture seule",
  },
  roleHints: {
    admin: "Peut tout faire, y compris le paramétrage et les invitations.",
    member: "Peut générer le menu, gérer le stock et mener la session.",
    viewer: "Peut consulter et cocher les courses.",
  },
  join: {
    title: (household: string) => `Rejoindre « ${household} »`,
    lead: (role: string) => `Tu es invité·e avec le rôle « ${role} ».`,
    accept: "Rejoindre le foyer",
    loginFirst: "Se connecter pour rejoindre",
    notFound: "Cette invitation n'existe pas. Vérifie le lien ou demande-en un nouveau.",
    expired: "Cette invitation a expiré. Demande un nouveau lien à l'administrateur du foyer.",
    used: "Cette invitation a déjà servi. Demande un nouveau lien à l'administrateur du foyer.",
  },
  settingsHousehold: {
    title: "Foyer",
    accounts: "Comptes liés",
    you: "toi",
    role: "Rôle",
    remove: "Retirer",
    removeConfirm: (name: string) => `Retirer ${name} du foyer ?`,
    leave: "Quitter ce foyer",
    leaveConfirm: "Quitter ce foyer ? Tu n'auras plus accès à son menu ni à ses courses.",
    invitations: "Invitations",
    inviteLead: "Crée un lien d'invitation valable 7 jours, utilisable une seule fois.",
    inviteRole: "Rôle de la personne invitée",
    inviteEmail: "E-mail (facultatif, pour t'en souvenir)",
    inviteCreate: "Créer le lien",
    inviteLink: "Lien à envoyer",
    copy: "Copier",
    copied: "Copié !",
    share: "Partager",
    shareText: (household: string) => `Rejoins le foyer « ${household} » sur Menu de la semaine`,
    pending: "En attente",
    expiresOn: (date: string) => `expire le ${date}`,
    revoke: "Révoquer",
    noPending: "Aucune invitation en attente.",
    adminOnly: "Seul un administrateur peut gérer les comptes et les invitations.",
  },
  appShell: {
    hello: (name: string) => `Salut, ${name}`,
    placeholder: "Le menu de la semaine arrive bientôt ici.",
    settings: "Réglages du foyer",
    signOut: "Se déconnecter",
  },
  errors: {
    generic: "Oups, ça n'a pas marché. Réessaie dans un instant.",
    forbidden: "Tu n'as pas les droits pour faire ça.",
    last_admin: "Le foyer doit garder au moins un administrateur. Nomme quelqu'un d'autre avant.",
    too_many_households: "Tu fais déjà partie de 5 foyers, c'est le maximum.",
    invitation_not_found: "Cette invitation n'existe pas.",
    invitation_expired: "Cette invitation a expiré.",
    invitation_used: "Cette invitation a déjà servi.",
  },
  /** Textes produits par le moteur (session, rangement). */
  engine: engineFr,
} as const;

export type Messages = typeof fr;
