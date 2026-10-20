import { describe, expect, it } from "vitest";
import robots, { DISALLOWED } from "@/app/robots";
import sitemap, { PUBLIC_PATHS } from "@/app/sitemap";

/** Correspondance robots.txt : préfixe, `$` en fin de motif pour une correspondance exacte. */
const blocked = (path: string) =>
  DISALLOWED.some((rule) => (rule.endsWith("$") ? path === rule.slice(0, -1) : path.startsWith(rule)));

describe("robots.txt et sitemap", () => {
  it("bloque les espaces connectés, l'API et les invitations", () => {
    for (const p of [
      "/app",
      "/app/shopping",
      "/asso",
      "/asso/menus",
      "/admin",
      "/admin/mfa",
      "/api/stripe/webhook",
      "/join/abc",
    ]) {
      expect(blocked(p), p).toBe(true);
    }
  });
  it("laisse passer la landing et ses pages (/associations ne commence pas par /asso/)", () => {
    for (const p of ["/", "/associations", "/associations/comment-ca-marche", "/cgu", "/mentions-legales"]) {
      expect(blocked(p), p).toBe(false);
    }
  });
  it("publie le sitemap dans robots.txt", () => {
    expect(robots().sitemap).toBe("https://finpret.app/sitemap.xml");
  });
  it("liste les pages publiques, sans /ecole, /app, /asso ni /admin", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://finpret.app/associations");
    expect(urls).toContain("https://finpret.app/associations/comment-ca-marche");
    expect(urls).toHaveLength(PUBLIC_PATHS.length);
    expect(urls.some((u) => /\/(ecole|app|asso|admin|join)(\/|$)/.test(u))).toBe(false);
  });
});
