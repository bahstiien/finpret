/** Sections du tableau de paramétrage (§6). Réservé à l'administrateur, sauf le Profil. */
export const ADMIN_SECTIONS = [
  "household",
  "diet",
  "menu",
  "session",
  "shopping",
  "canteen",
  "subscription",
  "data",
  "profile",
] as const;
export type SettingsSection = (typeof ADMIN_SECTIONS)[number];
export const MEMBER_SECTIONS: readonly SettingsSection[] = ["profile"];

/** Regroupement affiché dans la navigation et l'accueil des réglages : le foyer, la cuisine, le compte. */
export const SETTINGS_GROUPS = [
  { key: "household", sections: ["household", "subscription", "data"] },
  { key: "kitchen", sections: ["diet", "menu", "shopping", "session", "canteen"] },
  { key: "account", sections: ["profile"] },
] as const satisfies readonly { key: string; sections: readonly SettingsSection[] }[];
export type SettingsGroup = { key: (typeof SETTINGS_GROUPS)[number]["key"]; sections: SettingsSection[] };

/** Groupes visibles pour un rôle : un membre ne voit que son Profil. */
export function groupsFor(role: string): SettingsGroup[] {
  const allowed: readonly SettingsSection[] = role === "admin" ? ADMIN_SECTIONS : MEMBER_SECTIONS;
  return SETTINGS_GROUPS.map((g) => ({ key: g.key, sections: g.sections.filter((s) => allowed.includes(s)) })).filter(
    (g) => g.sections.length > 0,
  );
}
