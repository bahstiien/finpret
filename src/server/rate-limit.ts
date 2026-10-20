import "server-only";
import { headers } from "next/headers";

/**
 * Limitation de débit en mémoire (SPEC_JANVIER §8) : fenêtre glissante par clé.
 * Limite connue : par instance du serveur (pas de partage entre instances) ; suffisant pour freiner un abus
 * ordinaire. Un magasin partagé (Redis) viendra si le trafic l'exige.
 */
const hits = new Map<string, number[]>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Ménage : une clé qui n'a plus de coup récent disparaît.
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "inconnue";
}

/** Réinitialise le compteur (tests). */
export function resetRateLimits() {
  hits.clear();
}
