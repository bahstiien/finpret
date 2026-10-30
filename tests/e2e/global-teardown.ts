import { adminDb, closeAdminDb, TEST_EMAIL_DOMAIN, TEST_EMAIL_PREFIX } from "./helpers/auth";

/** Supprime les comptes de test (e2e-…@example.com) et les foyers qu'ils ont créés. */
export default async function globalTeardown() {
  if (!process.env.DATABASE_URL) return;
  const db = adminDb();
  try {
    const testUsers = await db
      .selectFrom("auth.users")
      .select("id")
      .where("email", "like", `${TEST_EMAIL_PREFIX}%${TEST_EMAIL_DOMAIN}`)
      .execute();
    if (testUsers.length === 0) return;
    const ids = testUsers.map((u) => u.id);

    // Les foyers d'abord : la base refuse de retirer le dernier administrateur d'un foyer existant.
    await db.deleteFrom("households").where("created_by", "in", ids).execute();
    // Puis les comptes : sessions et profil suivent en cascade.
    await db.deleteFrom("auth.users").where("id", "in", ids).execute();
  } finally {
    await closeAdminDb();
  }
}
