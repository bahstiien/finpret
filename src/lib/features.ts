/**
 * Drapeaux des fonctionnalités REPORTÉES par SPEC_JANVIER §2 : le code existe (jalons M7, M8, M8b, M10 de la SPEC V1)
 * mais n'est pas proposé au lancement de janvier. Passer un drapeau à `true` suffit à le réactiver.
 * Constantes de build (pas d'environnement) : une fonctionnalité masquée ne doit pas pouvoir s'activer par erreur en production.
 */
export const FEATURES = {
  /** Apple comme fournisseur de connexion (REPORTÉ). */
  appleSignIn: false,
  /** Rôle `viewer` (lecture seule) proposé à l'invitation et dans l'équipe (REPORTÉ). */
  viewerRole: false,
  /** Étape « habitudes » de l'onboarding (REPORTÉ) : valeurs par défaut utilisées. */
  onboardingHabits: false,
  /** Garde alternée (REPORTÉ). */
  alternatingCustody: false,
  /** Réserve congélateur et restes après la session (M7, REPORTÉ). */
  freezerAndLeftovers: false,
  /** Import de recettes par lien (M8b, REPORTÉ). */
  recipeImport: false,
  /** Synchronisation de la session entre appareils (M8, REPORTÉ). */
  sharedSession: false,
  /** Écriture hors ligne des courses avec rejeu (REPORTÉ) ; la lecture hors ligne reste active. */
  offlineWrites: false,
  /** Rappels « courses prêtes » et « début de session » (REPORTÉ) : seuls dîner, décongélation, menus publiés et fin d'essai partent. */
  shoppingSessionNotifications: false,
  /** Cantine saisie par enfant ou par lien (M10) : remplacée par les menus d'école publiés par l'association. */
  householdCanteen: true,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
