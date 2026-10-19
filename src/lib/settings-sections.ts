/** Sections du tableau de paramétrage (§6). Réservé à l'administrateur, sauf le Profil. */
export const ADMIN_SECTIONS = [
  "household",
  "diet",
  "menu",
  "session",
  "shopping",
  "canteen",
  "data",
  "profile",
] as const;
export type SettingsSection = (typeof ADMIN_SECTIONS)[number];
export const MEMBER_SECTIONS: readonly SettingsSection[] = ["profile"];
