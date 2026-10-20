import { describe, expect, it } from "vitest";
import { associationsFr, howItWorksFr } from "@/i18n/associations";
import { estimateAnnualAmount, SIM_FAMILIES, SIM_SHARE } from "@/lib/simulator";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("landing /associations : SEO", () => {
  it("respecte les longueurs de titre (60) et de description (155)", () => {
    expect(associationsFr.meta.title.length).toBeLessThanOrEqual(60);
    expect(associationsFr.meta.description.length).toBeLessThanOrEqual(155);
    expect(howItWorksFr.meta.title.length).toBeLessThanOrEqual(65);
    expect(howItWorksFr.meta.description.length).toBeLessThanOrEqual(160);
  });
  it("reprend les textes de référence de la spec", () => {
    expect(associationsFr.hero.title).toBe("Financez les projets de votre APE, sans vendre de chocolats");
    expect(associationsFr.how.steps).toHaveLength(4);
    expect(associationsFr.faq.items).toHaveLength(6);
    expect(associationsFr.problem.cards).toHaveLength(3);
  });
  it("la page satellite fait environ 1 200 mots", () => {
    const text = [
      howItWorksFr.title,
      howItWorksFr.lead,
      ...howItWorksFr.sections.flatMap((s) => [
        s.title,
        ...(s.paragraphs ?? []),
        ...(s.ordered ?? []),
        ...(s.bullets ?? []),
      ]),
    ].join(" ");
    expect(words(text)).toBeGreaterThan(850);
    expect(words(text)).toBeLessThan(1500);
  });
});

describe("simulateur", () => {
  it("calcule familles × part × 8 €, arrondi à la dizaine", () => {
    expect(estimateAnnualAmount(SIM_FAMILIES.default, SIM_SHARE.default)).toBe(240);
    expect(estimateAnnualAmount(800, 30)).toBe(1920);
    expect(estimateAnnualAmount(50, 5)).toBe(20);
    expect(estimateAnnualAmount(333, 17)).toBe(450);
  });
  it("reste dans les bornes des curseurs", () => {
    expect(estimateAnnualAmount(10_000, 90)).toBe(1920);
    expect(estimateAnnualAmount(0, 0)).toBe(20);
  });
});
