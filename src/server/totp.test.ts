import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpCode, totpUri, verifyTotp } from "./totp";

// Clé de test de la RFC 6238 (annexe B) : « 12345678901234567890 » en ASCII.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("encode et décode le base32", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(RFC_SECRET).toString()).toBe("12345678901234567890");
  });

  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("reproduit les vecteurs de la RFC 6238 (t = %i s)", (seconds, code) => {
    expect(totpCode(RFC_SECRET, seconds * 1000)).toBe(code);
  });

  it("accepte le pas voisin mais pas au-delà", () => {
    const now = 1_700_000_000_000;
    const code = totpCode(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, now + 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 90_000)).toBe(false);
  });

  it("refuse un code mal formé", () => {
    expect(verifyTotp(RFC_SECRET, "12345")).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef")).toBe(false);
  });

  it("génère une clé de 160 bits et une URI otpauth", () => {
    const secret = generateTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    expect(totpUri(secret, "admin@finpret.app")).toMatch(/^otpauth:\/\/totp\/Fin%20Pr%C3%AAt%3Aadmin%40finpret\.app\?secret=/);
  });
});
