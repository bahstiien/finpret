import "server-only";
import { withAdmin } from "@/server/db";

/** Adresse e-mail d'un compte. */
export async function emailOf(userId: string): Promise<string | null> {
  const row = await withAdmin((db) =>
    db.selectFrom("auth.users").select("email").where("id", "=", userId).executeTakeFirst(),
  );
  return row?.email ?? null;
}

/** Compte retrouvé par son adresse e-mail, sans tenir compte de la casse (support du back-office). */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const row = await withAdmin((db) =>
    db
      .selectFrom("auth.users")
      .select(["id", "email"])
      .where((eb) => eb(eb.fn("lower", ["email"]), "=", email.toLowerCase()))
      .executeTakeFirst(),
  );
  return row ? { id: row.id, email: row.email ?? "" } : null;
}

/** Supprime un compte : ses sessions, comptes OAuth et données personnelles suivent par cascade. */
export async function deleteUser(userId: string): Promise<void> {
  await withAdmin((db) => db.deleteFrom("auth.users").where("id", "=", userId).execute());
}
