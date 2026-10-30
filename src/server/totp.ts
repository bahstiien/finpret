import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Codes TOTP (RFC 6238 : HMAC-SHA1, 6 chiffres, pas de 30 s), compatibles avec les applications d'authentification. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;
const DIGITS = 6;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(ch);
    if (index < 0) throw new Error("Clé TOTP invalide.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Clé de 160 bits, en base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, timeMs = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / STEP)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Accepte le code du pas courant et des pas voisins (décalage d'horloge du téléphone). */
export function verifyTotp(secret: string, code: string, timeMs = Date.now(), window = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (let i = -window; i <= window; i++) {
    const expected = totpCode(secret, timeMs + i * STEP * 1000);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}

/** URI à encoder en QR code pour l'application d'authentification. */
export function totpUri(secret: string, account: string, issuer = "Fin Prêt"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP) });
  return `otpauth://totp/${label}?${params}`;
}
