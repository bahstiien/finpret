/**
 * Validation des liens d'import (§8.8, protection contre la SSRF) : http ou https uniquement, ni localhost,
 * ni adresse privée, réservée ou de lien local. L'adresse IP résolue est vérifiée par le serveur avant la requête.
 */

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: "invalid" | "scheme" | "private" };

const BLOCKED_HOSTS =
  /^(localhost|localhost\.localdomain|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i;

export function checkUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "scheme" };
  if (url.username || url.password) return { ok: false, reason: "invalid" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.test(host) || isPrivateIp(host)) return { ok: false, reason: "private" };
  return { ok: true, url };
}

/** Adresse IPv4 ou IPv6 privée, de bouclage, de lien local, réservée ou non routable. */
export function isPrivateIp(host: string): boolean {
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const h = host.toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIp(mapped[1]!);
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(h);
}

/** Lien de la cible de partage : l'URL peut arriver dans `url` ou au milieu du texte partagé. */
export function urlFromShare(params: {
  url?: string | null;
  text?: string | null;
  title?: string | null;
}): string {
  if (params.url) return params.url;
  const match = `${params.text ?? ""} ${params.title ?? ""}`.match(/https?:\/\/\S+/);
  return match ? match[0].replace(/[).,;]+$/, "") : "";
}

/** Nom du site affiché sous une recette importée (« Source : Marmiton »). */
export function siteName(url: URL, fromPage?: string | null): string {
  if (fromPage && fromPage.trim()) return fromPage.trim().slice(0, 60);
  const KNOWN: Record<string, string> = {
    "marmiton.org": "Marmiton",
    "750g.com": "750g",
    "cuisineaz.com": "Cuisine AZ",
    "journaldesfemmes.fr": "Journal des Femmes",
    "ricardocuisine.com": "Ricardo",
  };
  const host = url.hostname.replace(/^www\./, "");
  const known = Object.entries(KNOWN).find(([d]) => host === d || host.endsWith(`.${d}`));
  return known ? known[1] : host;
}
