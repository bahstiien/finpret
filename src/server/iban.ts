import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * IBAN des associations (SPEC_JANVIER §8) : chiffrement AES-256-GCM côté serveur avec IBAN_ENCRYPTION_KEY
 * (32 octets en hexadécimal). On stocke `iban_encrypted` (iv · tag · données, en base64) et `iban_last4` ;
 * l'IBAN n'est jamais renvoyé en clair au navigateur et n'est déchiffré que pour l'export CSV des administrateurs.
 */

const keyFrom = (hex = process.env.IBAN_ENCRYPTION_KEY ?? "") => {
  if (!/^[0-9a-fA-F]{64}$/.test(hex))
    throw new Error("IBAN_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux (32 octets).");
  return Buffer.from(hex, "hex");
};

export function encryptIban(iban: string, keyHex?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(keyHex), iv);
  const data = Buffer.concat([cipher.update(iban, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptIban(payload: string, keyHex?: string): string {
  const raw = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(keyHex), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** IBAN sans espaces en majuscules, ou null s'il est invalide (longueur, caractères, clé de contrôle modulo 97). */
export function normalizeIban(raw: string): string | null {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of digits) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1 ? iban : null;
}

export const ibanLast4 = (iban: string) => iban.slice(-4);

/** IBAN affiché par groupes de 4 (export, support). */
export const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();
