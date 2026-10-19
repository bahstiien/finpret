/** Textes de l'interface (CLAUDE.md, règle 5) : tutoiement, ton chaleureux et direct. */
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
    loginSoon: "La connexion arrive bientôt.",
  },
} as const;

export type Messages = typeof fr;
