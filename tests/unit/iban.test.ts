import { describe, expect, it } from "vitest";
import { decryptIban, encryptIban, formatIban, ibanLast4, normalizeIban } from "@/server/iban";

const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const IBAN = "FR7630006000011234567890189";

describe("IBAN des associations", () => {
  it("se chiffre et se déchiffre sans rien révéler en clair", () => {
    const secret = encryptIban(IBAN, KEY);
    expect(secret).not.toContain(IBAN);
    expect(secret).not.toContain(IBAN.slice(4, 14));
    expect(decryptIban(secret, KEY)).toBe(IBAN);
  });
  it("chaque chiffrement est différent (vecteur d'initialisation aléatoire)", () => {
    expect(encryptIban(IBAN, KEY)).not.toBe(encryptIban(IBAN, KEY));
  });
  it("refuse un message altéré ou une mauvaise clé", () => {
    const secret = Buffer.from(encryptIban(IBAN, KEY), "base64");
    secret[secret.length - 1]! ^= 1;
    expect(() => decryptIban(secret.toString("base64"), KEY)).toThrow();
    expect(() => decryptIban(encryptIban(IBAN, KEY), "ff".repeat(32))).toThrow();
  });
  it("exige une clé de 32 octets", () => {
    expect(() => encryptIban(IBAN, "abcd")).toThrow(/IBAN_ENCRYPTION_KEY/);
  });
  it("valide la clé de contrôle et normalise la saisie", () => {
    expect(normalizeIban("fr76 3000 6000 0112 3456 7890 189")).toBe(IBAN);
    expect(normalizeIban("FR7630006000011234567890188")).toBeNull();
    expect(normalizeIban("n'importe quoi")).toBeNull();
  });
  it("garde les 4 derniers caractères pour l'affichage", () => {
    expect(ibanLast4(IBAN)).toBe("0189");
    expect(formatIban(IBAN)).toBe("FR76 3000 6000 0112 3456 7890 189");
  });
});
