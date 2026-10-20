/** Routes qui demandent une session. */
export const PROTECTED_PREFIXES = ["/app", "/onboarding", "/settings", "/asso", "/admin"] as const;

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
