import { describe, expect, it } from "vitest";
import { gettingStartedFr } from "@/i18n/getting-started";

/** Principe 4 de SPEC_PRISE_EN_MAIN : jamais culpabilisant. */
const FORBIDDEN = [/pas encore/i, /n['’]as pas/i, /aurais dû/i, /en retard/i, /oublié/i];

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  // Les fonctions de texte reçoivent des valeurs d'exemple pour tous leurs paramètres.
  if (typeof value === "function") return strings((value as (...a: unknown[]) => unknown)(3, 6, "3 h", "17:30"));
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("textes de la prise en main", () => {
  const all = strings(gettingStartedFr);
  it("contiennent des textes", () => {
    expect(all.length).toBeGreaterThan(40);
  });
  it.each(FORBIDDEN.map((re) => [String(re), re] as const))("aucun texte ne contient %s", (_name, re) => {
    // « Pas encore de menu de cantine » décrit l'état d'une donnée externe, pas un reproche à la personne.
    const hits = all.filter((s) => re.test(s) && !/menu de cantine/i.test(s));
    expect(hits).toEqual([]);
  });
  it("les bulles tiennent en 2 phrases au plus", () => {
    for (const key of ["menu", "shopping", "stock", "session", "discover"] as const) {
      const sentences = gettingStartedFr.tips[key].split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, key).toBeLessThanOrEqual(2);
    }
  });
  it("aucun texte ne contient undefined ni NaN", () => {
    expect(all.filter((s) => /undefined|NaN/.test(s))).toEqual([]);
  });
});
