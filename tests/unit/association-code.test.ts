import { describe, expect, it } from "vitest";
import { codeFromName, isValidCode, normalizeCode, withSuffix } from "@/lib/association-code";

describe("code d'association", () => {
  it("se déduit du nom : majuscules, sans accents ni espaces", () => {
    expect(codeFromName("APE Jules Ferry")).toBe("APE-JULESFERRY");
    expect(codeFromName("Les P'tits Écoliers de Lyon")).toBe("APE-LESPTITSECOLIERS");
  });
  it("est tronqué à 20 caractères et reste valide", () => {
    const code = codeFromName("Association des parents d'élèves de l'école élémentaire");
    expect(code.length).toBeLessThanOrEqual(20);
    expect(isValidCode(code)).toBe(true);
  });
  it("ne tombe jamais sous 4 caractères", () => {
    expect(isValidCode(codeFromName("É"))).toBe(true);
    expect(isValidCode(codeFromName(""))).toBe(true);
  });
  it("accepte la saisie d'un parent en minuscules avec espaces", () => {
    expect(normalizeCode(" ape-jules ferry ")).toBe("APE-JULESFERRY");
    expect(normalizeCode("ape_é")).toBe("APEE");
  });
  it("numérote un code déjà pris sans dépasser 20 caractères", () => {
    expect(withSuffix("APE-JULESFERRY", 2)).toBe("APE-JULESFERRY2");
    expect(withSuffix("APE-12345678901234567", 12)).toHaveLength(20);
  });
  it("valide le format de la spec", () => {
    expect(isValidCode("APE-X")).toBe(true);
    expect(isValidCode("abc")).toBe(false);
    expect(isValidCode("A".repeat(21))).toBe(false);
    expect(isValidCode("APE JF")).toBe(false);
  });
});
