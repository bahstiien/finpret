import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { landingV2 } from "@/i18n/landing";
import { DESCRIPTION_MAX, TITLE_MAX } from "./meta";
import { homeJsonLd } from "./jsonld";

describe("accueil", () => {
  const { metaTitle, metaDescription } = fr.landing;

  it("title et description dans les limites et ciblent le produit", () => {
    expect(metaTitle.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(metaDescription.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(metaTitle).toMatch(/batch cooking/i);
    expect(metaTitle).toMatch(/familles/i);
  });

  it("le H1 exprime le besoin", () => {
    expect(`${landingV2.hero.titlePlain} ${landingV2.hero.titleMark}`).toMatch(/batch cooking en famille/i);
  });

  it("JSON-LD : aucune note, avis ni prix", () => {
    const json = JSON.stringify(homeJsonLd(metaDescription));
    expect(json).not.toMatch(/aggregateRating|review|offers|price/i);
    expect(json).toContain("SoftwareApplication");
  });

  it("le pied de page lie les pages publiques du catalogue", () => {
    expect(landingV2.footer.explore.map((l) => l.href)).toEqual(["/recettes", "/menus", "/batch-cooking"]);
  });
});
