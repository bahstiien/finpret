import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { withAdmin } from "@/server/db";
import { allow } from "@/server/rate-limit";
import { generateTotpSecret, totpUri, verifyTotp } from "@/server/totp";

/**
 * Second facteur TOTP du back-office (SPEC_JANVIER §8) : la clé de l'administrateur est
 * chiffrée en base (AES-256-GCM, clé dérivée de BETTER_AUTH_SECRET) et un code valide marque la session courante
 * (`auth.sessions.mfa_verified_at`), l'équivalent du niveau aal2.
 */

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET manque (voir .env.example).");
  return createHash("sha256").update(`mfa:${secret}`).digest();
}

function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export type MfaEnrollment = { enrolled: true } | { enrolled: false; qr: string; secret: string };

/** Facteur déjà validé, ou nouvelle clé à scanner (une clé commencée mais jamais validée est remplacée). */
export async function startMfaEnrollment(user: { id: string; email: string }): Promise<MfaEnrollment> {
  const existing = await withAdmin((db) =>
    db.selectFrom("auth.admin_totp").select("verified_at").where("user_id", "=", user.id).executeTakeFirst(),
  );
  if (existing?.verified_at) return { enrolled: true };
  const secret = generateTotpSecret();
  await withAdmin((db) =>
    db
      .insertInto("auth.admin_totp")
      .values({ user_id: user.id, secret_encrypted: encrypt(secret) })
      .onConflict((oc) =>
        oc
          .column("user_id")
          .doUpdateSet({ secret_encrypted: encrypt(secret), created_at: new Date().toISOString() }),
      )
      .execute(),
  );
  return { enrolled: false, qr: await QRCode.toDataURL(totpUri(secret, user.email)), secret };
}

/** Vérifie le code ; s'il est bon, valide le facteur et la session. 5 essais par tranche de 10 minutes. */
export async function verifyMfa(
  userId: string,
  sessionId: string,
  code: string,
): Promise<"ok" | "invalid" | "locked"> {
  if (!allow(`mfa:${userId}`, 5, 600_000)) return "locked";
  const row = await withAdmin((db) =>
    db
      .selectFrom("auth.admin_totp")
      .select("secret_encrypted")
      .where("user_id", "=", userId)
      .executeTakeFirst(),
  );
  if (!row || !verifyTotp(decrypt(row.secret_encrypted), code)) return "invalid";
  await withAdmin(async (db) => {
    await db
      .updateTable("auth.admin_totp")
      .set({ verified_at: new Date().toISOString() })
      .where("user_id", "=", userId)
      .where("verified_at", "is", null)
      .execute();
    await db
      .updateTable("auth.sessions")
      .set({ mfa_verified_at: new Date().toISOString() })
      .where("id", "=", sessionId)
      .where("user_id", "=", userId)
      .execute();
  });
  return "ok";
}
