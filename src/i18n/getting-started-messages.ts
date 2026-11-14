/**
 * Séquence de messages de la prise en main (SPEC_PRISE_EN_MAIN §4.5) : e-mail et Web Push.
 * Tutoiement, concret, jamais culpabilisant. Les variables sont calculées côté serveur.
 */
import type { MessageKey } from "@/engine/getting-started-messages";

export type MessageVars = {
  name: string;
  meals: number;
  sessionDay: string;
  sessionTime: string;
  articles: number;
  duration: string;
  end: string;
  boxes: number;
  fridge: number;
  freezer: number;
};

export type MessageCopy = {
  subject: string;
  paragraphs: (v: MessageVars) => string[];
  cta: string;
  /** Lien du bouton, relatif à l'application. */
  url: string;
  /** Second lien discret (texte et URL), facultatif. */
  secondary?: { label: string; url: string };
  push: { title: string; body: (v: MessageVars) => string };
};

const hello = (v: MessageVars) => (v.name ? `Bonjour ${v.name},` : "Bonjour,");
const boxWord = (n: number) => (n > 1 ? "boîtes" : "boîte");

export const messagesFr: Record<MessageKey, MessageCopy> = {
  welcome: {
    subject: "Bienvenue chez Fin Prêt, ta semaine est prête",
    paragraphs: (v) => [
      `${hello(v)} ta première semaine est prête : ${v.meals} repas, ta liste de courses et une session le ${v.sessionDay} à ${v.sessionTime}.`,
      "Voilà ce qui t'attend cette semaine : jeter un œil au menu et changer ce qui ne te tente pas, faire tes courses avec la liste, puis cuisiner le tout d'un coup avec la session guidée.",
      "Tu avances à ton rythme, on t'aide au bon moment.",
    ],
    cta: "Voir mon menu",
    url: "/app",
    push: {
      title: "Ta semaine est prête",
      body: (v) => `${v.meals} repas, une liste, une session le ${v.sessionDay}.`,
    },
  },
  shopping_eve: {
    subject: "Ta liste de courses est prête",
    paragraphs: (v) => [
      `${v.name ? `${v.name}, demain` : "Demain"}, c'est ton jour de courses. Ta liste compte ${v.articles} articles, rangés par rayon.`,
      "Si quelqu'un fait les courses avec toi, vous cochez chacun de votre côté et la liste se met à jour en direct.",
    ],
    cta: "Ouvrir ma liste",
    url: "/app/shopping",
    push: { title: "Ta liste est prête", body: (v) => `${v.articles} articles, rangés par rayon.` },
  },
  session_eve: {
    subject: "Demain, ta première session",
    paragraphs: (v) => [
      `Demain, tu cuisines ta semaine en ${v.duration}, fin prévue vers ${v.end}.`,
      `Pour être prêt·e : ${v.boxes} ${boxWord(v.boxes)} (${v.fridge} pour le frigo, ${v.freezer} pour le congélateur), de la place au frigo et au congélateur, et tes courses faites.`,
      "Tout le détail est dans ta fiche de préparation.",
    ],
    cta: "Préparer ma session",
    url: "/app?prep=1",
    push: {
      title: "Demain, ta première session",
      body: (v) => `${v.boxes} ${boxWord(v.boxes)}, ${v.duration}, fin vers ${v.end}.`,
    },
  },
  session_late: {
    subject: "On décale ta session ?",
    paragraphs: (v) => [
      `Ta session était prévue ${v.sessionDay}. Ça arrive : une semaine a ses imprévus.`,
      "Tu peux la caler sur un autre jour, ou alléger ta semaine pour cuisiner moins d'un coup. Dans les deux cas, ton menu reste là.",
    ],
    cta: "Choisir un autre jour",
    url: "/settings/session",
    secondary: { label: "Alléger ma semaine", url: "/settings/menu" },
    push: { title: "On décale ta session ?", body: () => "Choisis un autre jour ou allège ta semaine." },
  },
  session_after: {
    subject: "Bravo, ta première session est faite",
    paragraphs: (v) => [
      `Tes ${v.meals} repas sont prêts, bravo !`,
      "Les soirs de semaine, c'est simple : sors la boîte du jour, réchauffe, et c'est prêt.",
      "Chaque soir, le programme du jour te dit quoi servir et quoi sortir du congélateur pour le lendemain.",
    ],
    cta: "Voir ce soir",
    url: "/app",
    push: {
      title: "Bravo, ta première session est faite",
      body: () => "Ce soir, il suffit de réchauffer.",
    },
  },
  week2: {
    subject: "Ta semaine 2 t'attend",
    paragraphs: () => [
      "Ta première semaine est derrière toi.",
      "Pour la suivante, l'app compose les repas et la liste en quelques secondes, et tu ajustes ce que tu veux.",
    ],
    cta: "Préparer ma semaine 2",
    url: "/app",
    push: { title: "Ta semaine 2 t'attend", body: () => "Prépare-la en deux minutes." },
  },
};
