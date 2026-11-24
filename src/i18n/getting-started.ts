/** Textes de la prise en main (SPEC_PRISE_EN_MAIN §4) : tutoiement, concret, jamais culpabilisant. */
export const gettingStartedFr = {
  checklist: {
    title: "Ta première semaine",
    progress: (n: number, total: number) => `${n} sur ${total}`,
    progressLabel: (n: number, total: number) => `${n} étapes sur ${total} terminées`,
    subtitle: "Chaque étape se coche toute seule quand tu la fais.",
    optional: "Facultatif",
    done: "Fait",
    collapse: "Réduire la carte",
    expand: "Développer la carte",
    dismiss: "Masquer, je me débrouille",
    dismissed: "Checklist masquée. Tu la retrouves dans Profil > Aide.",
    undo: "Annuler",
    soloDone: "Tu cuisines seul·e, c'est noté. Tu pourras inviter quelqu'un quand tu voudras.",
    steps: {
      discover_menu: { label: "Découvrir ton menu" },
      adjust_meal: {
        label: "Ajuster un repas",
        hint: "Change, déplace ou retire un plat qui ne te tente pas.",
        cta: "Voir mes plats",
      },
      invite: {
        label: "Inviter la personne qui cuisine ou fait les courses avec toi",
        hint: "Vous partagez la même liste de courses, en direct.",
        cta: "Inviter",
        solo: "Je cuisine seul·e",
      },
      shop: {
        label: "Cocher tes courses",
        hint: "Coche chaque article au fil du magasin.",
        cta: "Ouvrir ma liste",
      },
      start_session: {
        label: "Lancer ta session",
        hint: "Une session, c'est toute ta semaine cuisinée en une fois.",
        cta: "Voir ma session",
      },
      finish_session: {
        label: "Terminer ta session",
        hint: "Tes repas sont prêts, il ne reste qu'à les réchauffer.",
        cta: "Voir ma session",
        ctaResume: "Reprendre ma session",
      },
    },
    success: {
      title: "Bravo, ta première semaine est bouclée",
      text: "Tu as cuisiné ta semaine et tu sais comment tout ça marche. Pour la suite, ta semaine 2 se prépare en deux minutes.",
      next: "Préparer ma semaine 2",
      close: "Fermer",
    },
  },
  tips: {
    ok: "Compris",
    close: "Fermer le conseil",
    region: "Conseil",
    menu: "Touche un plat pour voir sa recette. Si un plat ne te tente pas, « Organiser » te laisse le changer.",
    shopping:
      "Ta liste est rangée par rayon. Coche en magasin : ceux qui partagent le foyer voient la liste se mettre à jour en direct.",
    stock: "Note ici ce que tu as déjà : la liste de courses n'achète que ce qui manque. Ajuste les quantités avec − et +.",
    session:
      "Voici la durée prévue et l'heure de fin. Tu lances la session quand tu es prêt·e : rien ne démarre tout seul.",
    discover:
      "Parcours les recettes par région, saison ou régime. « Mettre au menu » ajoute celle qui te plaît à ta semaine.",
  },
  tile: {
    titleEve: "Demain, ta première session",
    titleToday: "Aujourd'hui, ta première session",
    subtitle: "Cinq minutes de préparation pour cuisiner l'esprit tranquille.",
    cta: "Préparer ma session",
    later: "Plus tard",
  },
  prepSheet: {
    title: "Demain, ta première session",
    titleToday: "Aujourd'hui, ta première session",
    boxesTitle: "Tes boîtes",
    boxes: (n: number, fridge: number, freezer: number) =>
      `${n} ${n > 1 ? "boîtes" : "boîte"} à prévoir : ${fridge} pour le frigo, ${freezer} pour le congélateur.`,
    boxLine: (portions: string, label: string, box: string | null) =>
      `1 boîte de ${portions} portions · ${label}${box ? ` · ${box}` : ""}`,
    roomTitle: "De la place",
    room: (fridge: number, freezer: number) =>
      freezer > 0
        ? `Libère de la place pour ${fridge} ${fridge > 1 ? "boîtes" : "boîte"} au frigo et ${freezer} au congélateur.`
        : `Libère de la place pour ${fridge} ${fridge > 1 ? "boîtes" : "boîte"} au frigo.`,
    shoppingTitle: "Tes courses",
    shopping: (checked: number, total: number) => `${checked} articles sur ${total} sont cochés.`,
    shoppingDone: "Tes courses sont faites.",
    shoppingCta: "Vérifier ma liste",
    durationTitle: "Durée prévue",
    duration: (duration: string, end: string) => `Compte ${duration} : fin prévue vers ${end}.`,
    levelTitle: "Ton niveau",
    levelLabel: "Niveau de la première session",
    beginner: "Débutant",
    confident: "À l'aise",
    levelHint: "Débutant ajoute 20 % de marge à chaque étape, pour cuisiner sans courir.",
    ok: "C'est noté",
    session: "Voir ma session",
    move: "Décaler la session",
    moveAsk: "Demande à l'administrateur du foyer de décaler la session.",
  },
  firstSession: {
    levelLabel: "Niveau de cette session",
    beginner: "Débutant",
    confident: "À l'aise",
    levelHint: "Débutant ajoute 20 % de marge à chaque étape.",
    tips: {
      fs_wake: "Ton écran reste allumé pendant la session : pas besoin de le toucher pour qu'il ne s'éteigne pas.",
      fs_timers:
        "Tes minuteurs restent en haut sur tous les onglets. Tu peux aller voir ta liste ou ton stock sans rien perdre.",
      fs_next:
        "Toutes les tâches sont cochées : le bouton passe au vert. Appuie dessus pour passer à l'étape suivante.",
    },
    done: {
      title: "Ta première session est faite",
      meals: (n: number) => `${n} ${n > 1 ? "repas préparés" : "repas préparé"}`,
      duration: (d: string) => `Durée réelle : ${d}`,
      monday: (text: string) => `Lundi soir : ${text}`,
      next: (day: string, text: string) => `Ton prochain dîner, ${day} : ${text}`,
      closing: "Les soirs de semaine, il te suffit de sortir la boîte du jour et de la réchauffer.",
      cta: "Voir ce soir",
    },
  },
  empty: {
    menuNoWeek: {
      title: "Ta semaine commence ici",
      text: "Fin Prêt compose tes repas du lundi au vendredi, puis ta liste de courses et ta session.",
      action: "Préparer ma semaine",
    },
    menuDay: {
      title: "Rien de prévu ce jour-là",
      text: "Les repas que tu retires restent dans la semaine : tu peux les remettre quand tu veux.",
    },
    canteen: {
      title: "Pas encore de menu de cantine",
      text: "Le menu s'affiche ici dès que ton association le publie, avec l'alerte quand le dîner ressemble au déjeuner.",
    },
    shoppingNoWeek: {
      title: "Ta liste se remplit toute seule",
      text: "Elle apparaît dès que ta semaine est prête, rangée par rayon.",
      action: "Préparer ma semaine",
    },
    shoppingAllChecked: {
      title: "Tout est dans le panier",
      text: "Ta liste est complète : tu peux passer à ta session.",
      action: "Voir ma session",
    },
    pantry: {
      title: "Ton garde-manger est vide",
      text: "Il sert à ne pas racheter ce que tu as déjà : la liste n'achète que ce qui manque.",
      action: "Ajouter un ingrédient",
    },
    sessionNoWeek: {
      title: "Pas de session pour l'instant",
      text: "La session cuisine toute ta semaine en une fois, étape par étape. Elle apparaît dès que ta semaine est prête.",
      action: "Préparer ma semaine",
    },
    discoverNoResult: {
      title: "Aucune recette ne correspond",
      text: "Essaie avec moins de filtres ou un autre mot : le catalogue compte plus de 180 recettes de repas.",
      action: "Effacer les filtres",
    },
    discoverNoFavorite: {
      title: "Tes favoris arriveront ici",
      text: "Aime une recette pour la retrouver vite et la voir revenir plus souvent au menu.",
      action: "Parcourir les recettes",
    },
    team: {
      title: "Tu es seul·e pour l'instant",
      text: "Inviter la personne qui cuisine ou fait les courses avec toi lui donne la même liste, en direct.",
      action: "Inviter quelqu'un",
    },
    notifications: {
      title: "Les rappels sont coupés sur cet appareil",
      text: "Active-les pour recevoir ton plat du soir et le rappel de décongélation. Tu peux les couper quand tu veux.",
      action: "Activer les notifications",
      blocked: "Autorise-les dans les réglages de ton navigateur.",
    },
    assoNoMenu: {
      title: "Aucun menu publié ce mois-ci",
      text: "Les familles de ton école voient ici le menu de la cantine, jour après jour. Importe le PDF de la mairie ou saisis les repas.",
      action: "Importer un PDF",
    },
    assoDrafts: {
      title: "Des menus attendent ta validation",
      text: "Relis-les, corrige si besoin, puis publie : les familles sont prévenues une seule fois par semaine.",
      action: "Voir les brouillons",
    },
    print: {
      title: "Rien à imprimer pour l'instant",
      text: "La page imprimable reprend ta semaine sur une feuille A4.",
      action: "Préparer ma semaine",
    },
  },
} as const;
