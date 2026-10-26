/** Routes qui demandent une session. */
export const PROTECTED_PREFIXES = ["/app", "/onboarding", "/settings", "/asso", "/admin"] as const;

/** Routes à ne jamais indexer : en plus des routes protégées, la connexion, les liens d'invitation, l'API et le retour d'auth. */
export const NOINDEX_PREFIXES = [...PROTECTED_PREFIXES, "/login", "/join", "/api", "/auth"] as const;

export function isNoindexPath(pathname: string): boolean {
  return NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Chemin de retour après connexion, limité au site lui-même (pas de redirection ouverte).
 * Refuse les URL absolues, `//hôte`, `/\hôte` et tout ce qui n'est pas un chemin.
 */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
