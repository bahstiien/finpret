import type { Env } from "./env";

/**
 * Retour rapide sur un plat (facultatif, un tap) : deux signaux de goût et un signal de temps, indépendants.
 *  - goût : « à refaire » (`taste` = 1) et « aimé par les enfants » (`kids`) rapprochent le plat ;
 *    « refusé » (`taste` = -1) l'exclut du tirage (comportement historique des 👎) ;
 *  - temps : « trop long » (`long`) ne touche pas au goût, il espace seulement le plat.
 * Ces signaux ne font que pondérer le tirage : le régime, les allergies et les ingrédients refusés filtrent
 * le catalogue avant (voir `createEnv`), donc un signal positif ne peut jamais les contourner. TypeScript pur.
 */
export type RecipeFeedback = { taste: 1 | -1 | null; kids: boolean; long: boolean };

export const NO_FEEDBACK: RecipeFeedback = { taste: null, kids: false, long: false };

export type FeedbackAction = "redo" | "refuse" | "kids" | "long";

/** Même geste pour poser et pour corriger : retoucher un signal actif le retire. */
export function toggleFeedback(prev: RecipeFeedback, action: FeedbackAction): RecipeFeedback {
  switch (action) {
    case "redo":
      return { ...prev, taste: prev.taste === 1 ? null : 1 };
    case "refuse":
      // Un refus contredit « aimé par les enfants » : il l'efface.
      return prev.taste === -1 ? { ...prev, taste: null } : { ...prev, taste: -1, kids: false };
    case "kids":
      // Aimer un plat refusé lève le refus.
      return { taste: prev.taste === -1 ? null : prev.taste, kids: !prev.kids, long: prev.long };
    case "long":
      return { ...prev, long: !prev.long };
  }
}

export const isEmptyFeedback = (f: RecipeFeedback) => f.taste === null && !f.kids && !f.long;

/**
 * Poids ajoutés à la clé de tri du tirage (plus petit = proposé plus tôt, comme les −0,7 des favoris).
 * Tenus sous la dispersion de l'aléa (1) et du garde-manger pour garder de la variété.
 */
export const FEEDBACK_WEIGHT = { redo: 0.7, kids: 0.4, long: 0.8 } as const;

export function feedbackBias(env: Pick<Env, "ratings" | "feedback">, id: string): number {
  const f = env.feedback[id];
  return (
    (env.ratings[id] === 1 ? -FEEDBACK_WEIGHT.redo : 0) +
    (f?.kids ? -FEEDBACK_WEIGHT.kids : 0) +
    (f?.long ? FEEDBACK_WEIGHT.long : 0)
  );
}

/** Plat qu'on a envie de revoir : « à refaire » ou « aimé par les enfants ». */
export const isLiked = (env: Pick<Env, "ratings" | "feedback">, id: string) =>
  env.ratings[id] === 1 || !!env.feedback[id]?.kids;
