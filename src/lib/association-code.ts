/** Cookie qui mémorise le code d'association 30 jours (HttpOnly, SameSite=Lax). */
export const ASSOCIATION_COOKIE = "fp_asso";

/** Code d'une association (SPEC_JANVIER §5) : `APE-` + nom en majuscules sans accents ni espaces, tronqué à 20. */
export const CODE_PATTERN = /^[A-Z0-9-]{4,20}$/;

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** Met un code saisi à la forme canonique (majuscules, sans espaces) avant de le comparer ou de l'enregistrer. */
export function normalizeCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

/**
 * Code proposé depuis le nom : « APE Jules Ferry » → `APE-JULESFERRY`. Le préfixe `APE-` n'est pas doublé
 * si le nom commence déjà par « APE ».
 */
export function codeFromName(name: string): string {
  const base = normalizeCode(name.replace(/^\s*ape\b[\s-]*/i, ""));
  const code = `APE-${base}`.slice(0, 20).replace(/-+$/, "");
  return code.length >= 4 ? code : `APE-${base || "ECOLE"}`.slice(0, 20);
}

/** Variante numérotée quand le code est déjà pris (`APE-JULESFERRY2`), toujours dans la limite de 20 caractères. */
export function withSuffix(code: string, n: number): string {
  const suffix = String(n);
  return code.slice(0, 20 - suffix.length) + suffix;
}
