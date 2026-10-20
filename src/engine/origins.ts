/** Origines des recettes (`ORIGINS` du prototype) : nom, drapeau, région (filtre de Découvrir). */
export const ORIGINS: Record<string, { name: string; flag: string; region: string }> = {
  fr: { name: "France", flag: "🇫🇷", region: "France" },
  it: { name: "Italie", flag: "🇮🇹", region: "Italie" },
  es: { name: "Espagne", flag: "🇪🇸", region: "Méditerranée et Orient" },
  gr: { name: "Grèce", flag: "🇬🇷", region: "Méditerranée et Orient" },
  ma: { name: "Maroc", flag: "🇲🇦", region: "Méditerranée et Orient" },
  lb: { name: "Liban", flag: "🇱🇧", region: "Méditerranée et Orient" },
  tn: { name: "Tunisie", flag: "🇹🇳", region: "Méditerranée et Orient" },
  in: { name: "Inde", flag: "🇮🇳", region: "Asie" },
  th: { name: "Thaïlande", flag: "🇹🇭", region: "Asie" },
  jp: { name: "Japon", flag: "🇯🇵", region: "Asie" },
  kr: { name: "Corée", flag: "🇰🇷", region: "Asie" },
  cn: { name: "Chine", flag: "🇨🇳", region: "Asie" },
  as: { name: "Asie", flag: "🌏", region: "Asie" },
  mx: { name: "Mexique", flag: "🇲🇽", region: "Amériques" },
  us: { name: "États-Unis", flag: "🇺🇸", region: "Amériques" },
  uk: { name: "Royaume-Uni", flag: "🇬🇧", region: "Europe" },
  be: { name: "Belgique", flag: "🇧🇪", region: "Europe" },
  hu: { name: "Hongrie", flag: "🇭🇺", region: "Europe" },
  ch: { name: "Suisse", flag: "🇨🇭", region: "Europe" },
  // Absent du prototype alors que le seed l'utilise (2 recettes).
  vn: { name: "Viêt Nam", flag: "🇻🇳", region: "Asie" },
};

export const REGIONS = [...new Set(Object.values(ORIGINS).map((o) => o.region))];

/** Recette du monde : origine autre que la France. */
export const originOf = (code: string | undefined | null) => (code ? (ORIGINS[code] ?? null) : null);
